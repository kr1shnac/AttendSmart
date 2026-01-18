const User = require("../models/User");
const {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} = require("@simplewebauthn/server");

const rpName = "AttendSmart";
const rpID = process.env.RP_ID || "localhost";
const origin = process.env.ORIGIN || "http://localhost:3000";

// Step 1: Generate registration options for biometric setup
exports.registerBiometricOptions = async (req, res) => {
  try {
    const { usn } = req.body;

    const student = await User.findOne({
      usn,
      role: "student",
      isActive: true,
    });

    if (!student) {
      return res.status(404).json({
        status: "error",
        message: "Student not found",
      });
    }

    if (student.biometric_registered) {
      return res.status(400).json({
        status: "error",
        message: "Biometric already registered",
      });
    }

    const options = generateRegistrationOptions({
      rpName,
      rpID,
      userID: student._id.toString(),
      userName: student.usn,
      userDisplayName: student.name,
      attestationType: "none",
      authenticatorSelection: {
        authenticatorAttachment: "platform",
        requireResidentKey: false,
        userVerification: "required",
      },
      excludeCredentials: student.biometricCredentials.map((cred) => ({
        id: cred.credentialID,
        type: "public-key",
        transports: cred.transports,
      })),
    });

    // Store challenge temporarily
    student.currentChallenge = options.challenge;
    await student.save();

    res.json({
      status: "success",
      data: options,
    });
  } catch (error) {
    console.error("Register options error:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to generate registration options",
      error: error.message,
    });
  }
};

// Step 2: Verify biometric registration
exports.registerBiometricVerify = async (req, res) => {
  try {
    const { usn, credential } = req.body;

    const student = await User.findOne({ usn, role: "student" });

    if (!student) {
      return res.status(404).json({
        status: "error",
        message: "Student not found",
      });
    }

    const verification = await verifyRegistrationResponse({
      response: credential,
      expectedChallenge: student.currentChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
    });

    if (!verification.verified || !verification.registrationInfo) {
      return res.status(400).json({
        status: "error",
        message: "Biometric verification failed",
      });
    }

    const { credentialPublicKey, credentialID, counter } =
      verification.registrationInfo;

    // Store credential
    student.biometricCredentials.push({
      credentialID: Buffer.from(credentialID),
      credentialPublicKey: Buffer.from(credentialPublicKey),
      counter,
      transports: credential.response.transports || [],
    });

    student.biometric_registered = true;
    student.currentChallenge = undefined;
    await student.save();

    res.json({
      status: "success",
      message: "Biometric registered successfully",
    });
  } catch (error) {
    console.error("Register verify error:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to verify registration",
      error: error.message,
    });
  }
};

// Step 3: Generate login options
exports.loginBiometricOptions = async (req, res) => {
  try {
    // Get all students with biometric registered
    const students = await User.find({
      role: "student",
      biometric_registered: true,
      isActive: true,
    });

    const allowCredentials = students.flatMap((student) =>
      student.biometricCredentials.map((cred) => ({
        id: cred.credentialID,
        type: "public-key",
        transports: cred.transports,
      }))
    );

    const options = generateAuthenticationOptions({
      rpID,
      allowCredentials,
      userVerification: "required",
    });

    // Store challenge in session
    req.session.currentChallenge = options.challenge;

    res.json({
      status: "success",
      data: options,
    });
  } catch (error) {
    console.error("Login options error:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to generate login options",
      error: error.message,
    });
  }
};

// Step 4: Verify biometric login
exports.loginBiometricVerify = async (req, res) => {
  try {
    const { credential } = req.body;

    // Find student by credential ID
    const credentialIDBuffer = Buffer.from(credential.rawId);

    const student = await User.findOne({
      "biometricCredentials.credentialID": credentialIDBuffer,
      role: "student",
      isActive: true,
    });

    if (!student) {
      return res.status(404).json({
        status: "error",
        message: "Student not found",
      });
    }

    // Find the specific credential
    const dbCredential = student.biometricCredentials.find((cred) =>
      cred.credentialID.equals(credentialIDBuffer)
    );

    if (!dbCredential) {
      return res.status(404).json({
        status: "error",
        message: "Credential not found",
      });
    }

    const verification = await verifyAuthenticationResponse({
      response: credential,
      expectedChallenge: req.session.currentChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      authenticator: {
        credentialID: dbCredential.credentialID,
        credentialPublicKey: dbCredential.credentialPublicKey,
        counter: dbCredential.counter,
      },
    });

    if (!verification.verified) {
      return res.status(401).json({
        status: "error",
        message: "Biometric authentication failed",
      });
    }

    // Update counter
    dbCredential.counter = verification.authenticationInfo.newCounter;
    student.last_login = new Date();
    student.first_login = false;
    await student.save();

    // Generate JWT token
    const jwt = require("jsonwebtoken");
    const token = jwt.sign(
      {
        id: student._id,
        role: student.role,
        usn: student.usn,
      },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      status: "success",
      message: "Login successful",
      token,
      user: {
        id: student._id,
        name: student.name,
        usn: student.usn,
        email: student.email,
        role: student.role,
        biometric_registered: student.biometric_registered,
        first_login: student.first_login,
      },
    });
  } catch (error) {
    console.error("Login verify error:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to verify login",
      error: error.message,
    });
  }
};

// Manual login with USN + DOB (fallback)
exports.loginManual = async (req, res) => {
  try {
    const { usn, dateOfBirth } = req.body;

    const student = await User.findOne({
      usn: usn.toUpperCase(),
      role: "student",
      isActive: true,
    });

    if (!student) {
      return res.status(404).json({
        status: "error",
        message: "Invalid credentials",
      });
    }

    // Check if account is locked
    if (student.isLocked()) {
      return res.status(423).json({
        status: "error",
        message: "Account temporarily locked. Try again later.",
      });
    }

    // Verify date of birth
    const dobMatch =
      new Date(dateOfBirth).toDateString() ===
      new Date(student.dateOfBirth).toDateString();

    if (!dobMatch) {
      student.loginAttempts += 1;

      if (student.loginAttempts >= 5) {
        student.lockUntil = Date.now() + 30 * 60 * 1000; // Lock for 30 minutes
      }

      await student.save();

      return res.status(401).json({
        status: "error",
        message: "Invalid credentials",
      });
    }

    // Reset login attempts
    student.loginAttempts = 0;
    student.lockUntil = undefined;
    student.last_login = new Date();

    await student.save();

    // Generate JWT token
    const jwt = require("jsonwebtoken");
    const token = jwt.sign(
      {
        id: student._id,
        role: student.role,
        usn: student.usn,
      },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      status: "success",
      message: "Login successful",
      token,
      user: {
        id: student._id,
        name: student.name,
        usn: student.usn,
        email: student.email,
        role: student.role,
        biometric_registered: student.biometric_registered,
        first_login: student.first_login,
      },
    });
  } catch (error) {
    console.error("Manual login error:", error);
    res.status(500).json({
      status: "error",
      message: "Login failed",
      error: error.message,
    });
  }
};

// Teacher login with email + password
exports.loginTeacher = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({
      email: email.toLowerCase(),
      role: { $in: ["teacher", "admin"] },
      isActive: true,
    }).select("+password");

    if (!user) {
      return res.status(401).json({
        status: "error",
        message: "Invalid credentials",
      });
    }

    const isPasswordValid = await user.comparePassword(password);

    if (!isPasswordValid) {
      return res.status(401).json({
        status: "error",
        message: "Invalid credentials",
      });
    }

    user.last_login = new Date();
    user.first_login = false;
    await user.save();

    // Generate JWT token
    const jwt = require("jsonwebtoken");
    const token = jwt.sign(
      {
        id: user._id,
        role: user.role,
        email: user.email,
      },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      status: "success",
      message: "Login successful",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("Teacher login error:", error);
    res.status(500).json({
      status: "error",
      message: "Login failed",
      error: error.message,
    });
  }
};

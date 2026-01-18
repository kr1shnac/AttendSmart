/**
 * Jest Test Setup
 *
 * Configures MongoDB Memory Server for integration tests
 * and provides helper functions for test utilities.
 */

const { MongoMemoryServer } = require("mongodb-memory-server");
const mongoose = require("mongoose");

let mongoServer;

// Increase timeout for MongoDB Memory Server startup
jest.setTimeout(30000);

/**
 * Connect to in-memory MongoDB before all tests
 */
beforeAll(async () => {
  // Close any existing connections
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }

  // Start MongoDB Memory Server
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();

  // Connect mongoose to in-memory database
  await mongoose.connect(mongoUri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });

  console.log("✅ Connected to in-memory MongoDB");
});

/**
 * Clear database between tests
 */
afterEach(async () => {
  if (mongoose.connection.readyState === 1) {
    const collections = mongoose.connection.collections;
    for (const key in collections) {
      await collections[key].deleteMany({});
    }
  }
});

/**
 * Disconnect and stop MongoDB after all tests
 */
afterAll(async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  if (mongoServer) {
    await mongoServer.stop();
  }
  console.log("✅ Disconnected from in-memory MongoDB");
});

// Mock environment variables for tests
process.env.JWT_SECRET = "test-jwt-secret-for-testing-only";
process.env.JWT_EXPIRY = "1d";
process.env.NODE_ENV = "test";
process.env.SESSION_SECRET = "test-session-secret";

// Suppress console logs during tests (optional - comment out for debugging)
// global.console = {
//   ...console,
//   log: jest.fn(),
//   info: jest.fn(),
//   warn: jest.fn(),
// };

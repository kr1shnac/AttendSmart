// backend/scripts/seed-complete-data.js
// Comprehensive seed script for AIML, CSE, and AIDS classes
// Run: node scripts/seed-complete-data.js

require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const User = require("../models/User");
const Subject = require("../models/Subject");
const Class = require("../models/Class");
const Session = require("../models/Session");
const Attendance = require("../models/Attendance");

// ==========================================
// CONFIGURATION
// ==========================================
const SEMESTER = 5;
const ACADEMIC_YEAR = "2024-2025";
const STUDENT_DOB = new Date("2005-10-22"); // 22-10-2005

// ==========================================
// AIML STUDENTS DATA (User Provided)
// ==========================================
const aimlStudents = [
  {
    usn: "1EW23AI001",
    name: "Abhayaadithya N",
    phone: "8217370783",
    email: "abhay16n@gmail.com",
  },
  {
    usn: "1EW23AI003",
    name: "Adarsh",
    phone: "7204759935",
    email: "adarshasm2005@gmail.com",
  },
  {
    usn: "1EW23AI004",
    name: "Ajay BV",
    phone: "9449980497",
    email: "Ajaybv92@gmail.com",
  },
  {
    usn: "1EW23AI005",
    name: "Akarsh M",
    phone: "9632152709",
    email: "akarshmanjunath27@gmail.com",
  },
  {
    usn: "1EW23AI006",
    name: "Ankith M",
    phone: "6362426665",
    email: "ankithm464@gmail.com",
  },
  {
    usn: "1EW23AI007",
    name: "Ayan Ali Nadaf",
    phone: "7483023587",
    email: "ayanali10042005@gmail.com",
  },
  {
    usn: "1EW23AI008",
    name: "B M HOYSALA SANKETH",
    phone: "9448565013",
    email: "sankethbmh@gmail.com",
  },
  {
    usn: "1EW23AI009",
    name: "Bhavya G",
    phone: "8088349342",
    email: "gbhavya348@gmail.com",
  },
  {
    usn: "1EW23AI010",
    name: "Bhoopathi Raj",
    phone: "9019982050",
    email: "bhoopathiraj242@gmail.com",
  },
  {
    usn: "1EW23AI012",
    name: "Binutha.B.M",
    phone: "9741862678",
    email: "binuthabm@gmail.com",
  },
  {
    usn: "1EW23AI014",
    name: "Divya Sri S",
    phone: "7338483927",
    email: "divyasris05ppt@gmail.com",
  },
  {
    usn: "1EW23AI015",
    name: "Soumya",
    phone: "6366183063",
    email: "soumyagodavarthi@gmail.com",
  },
  {
    usn: "1EW23AI016",
    name: "Goutham Shekar S R",
    phone: "9148366369",
    email: "gouthamshekar2307@gmail.com",
  },
  {
    usn: "1EW23AI017",
    name: "Hemanth gowda a",
    phone: "6363257914",
    email: "hemanthagowda152006@gmail.com",
  },
  {
    usn: "1EW23AI019",
    name: "Jayanth Gowda HM",
    phone: "8050567624",
    email: "Jayanthgowdah7@gmail.com",
  },
  {
    usn: "1EW23AI020",
    name: "Jayanth Somashekar",
    phone: "9686277969",
    email: "jayanthss2345@gmail.com",
  },
  {
    usn: "1EW23AI021",
    name: "Jeevan Pranav D",
    phone: "9008176845",
    email: "pranavjeevan1234@gmail.com",
  },
  {
    usn: "1EW23AI022",
    name: "Karthik TB",
    phone: "6360740081",
    email: "karthik.raj28122004@gmail.com",
  },
  {
    usn: "1EW23AI023",
    name: "Koushik R",
    phone: "8951506863",
    email: "kowshikr3932@gmail.com",
  },
  {
    usn: "1EW23AI024",
    name: "Krishna C",
    phone: "9611990869",
    email: "krishnacgowda10@gmail.com",
  },
  {
    usn: "1EW23AI025",
    name: "L.Rakshitha",
    phone: "7019612066",
    email: "lrakshitha875@gmail.com",
  },
  {
    usn: "1EW23AI028",
    name: "Megha S Doni",
    phone: "9945390856",
    email: "meghadoni5@gmail.com",
  },
  {
    usn: "1EW23AI029",
    name: "Mohammed Nuhan",
    phone: "7019536523",
    email: "nuhanmohammed04@gmail.com",
  },
  {
    usn: "1EW23AI030",
    name: "Moulya.K.R",
    phone: "9606342419",
    email: "moulyakrm@gmail.com",
  },
  {
    usn: "1EW23AI032",
    name: "Namitha.N.R",
    phone: "8073499804",
    email: "namitharanganath1485@gmail.com",
  },
  {
    usn: "1EW23AI034",
    name: "Naveen G W",
    phone: "9739691999",
    email: "Waradnaveeng@gmail.com",
  },
  {
    usn: "1EW23AI036",
    name: "Nikhith Gowda R",
    phone: "8618860070",
    email: "jayaramyalinil@gmail.com",
  },
  {
    usn: "1EW23AI039",
    name: "Pavan S",
    phone: "9380776994",
    email: "pavanme2811@gmail.com",
  },
  {
    usn: "1EW23AI040",
    name: "Poorna Chandra Tejaswi",
    phone: "7760968091",
    email: "poonrachandra2005@gmail.com",
  },
  {
    usn: "1EW23AI041",
    name: "Prashanth L R",
    phone: "6362464341",
    email: "prashanth21156@gmail.com",
  },
  {
    usn: "1EW23AI042",
    name: "Prithviraj",
    phone: "9741893044",
    email: "prithvirajnaik1922@gmail.com",
  },
  {
    usn: "1EW23AI043",
    name: "Punith HM",
    phone: "7259360918",
    email: "hmpunith2006@gmail.com",
  },
  {
    usn: "1EW23AI044",
    name: "Rahul R",
    phone: "7483276952",
    email: "rahulr200528@gmail.com",
  },
  {
    usn: "1EW23AI045",
    name: "Rakshitha S P",
    phone: "8867940975",
    email: "rakshithasp176@gmail.com",
  },
  {
    usn: "1EW23AI046",
    name: "Ravitej",
    phone: "9380038245",
    email: "balakrishanmanu@gmail.com",
  },
  {
    usn: "1EW23AI047",
    name: "Rishika.B",
    phone: "8123505821",
    email: "rishikaoffical27@gmail.com",
  },
  {
    usn: "1EW23AI049",
    name: "Sahana S",
    phone: "8105486234",
    email: "sana1234@gmail.com",
  },
  {
    usn: "1EW23AI050",
    name: "Sanjana bai M R",
    phone: "8088348665",
    email: "officialsanjana653@gmail.com",
  },
  {
    usn: "1EW23AI051",
    name: "Sanjana Sindol",
    phone: "8296600463",
    email: "sindolsanjana@gmail.com",
  },
  {
    usn: "1EW23AI054",
    name: "Shreekanth K",
    phone: "9113826322",
    email: "shreekanth651@gmail.com",
  },
  {
    usn: "1EW23AI055",
    name: "Shubha P",
    phone: "8618338124",
    email: "shubhakumbar26@gmail.com",
  },
  {
    usn: "1EW23AI056",
    name: "Vaishnavi Myakalmaddi",
    phone: "7204082147",
    email: "vaishumyakalamaddi@gmail.com",
  },
  {
    usn: "1EW23AI057",
    name: "Varsha k",
    phone: "7975438747",
    email: "varshavarshak977@gmail.com",
  },
  {
    usn: "1EW23AI058",
    name: "Vinay Gowda PN",
    phone: "7090085650",
    email: "vinaygowdapn6@gmail.com",
  },
  {
    usn: "1EW23AI059",
    name: "Yashas V Gowda",
    phone: "9449988774",
    email: "yashasvgowda949@gmail.com",
  },
  {
    usn: "1EW24AI400",
    name: "Bhavana Sharanappa",
    phone: "6360946912",
    email: "bhavana.sharanappa@gmail.com",
  },
  {
    usn: "1EW24AI402",
    name: "Goutham B",
    phone: "8050477114",
    email: "gangam8861@gmail.com",
  },
  {
    usn: "1EW24AI403",
    name: "Jainth Kumar L",
    phone: "6363597515",
    email: "jnthljayanthl@gmail.com",
  },
  {
    usn: "1EW24AI404",
    name: "Kruthik Kumar K",
    phone: "6363280247",
    email: "darshank032004@gmail.com",
  },
  {
    usn: "1EW24AI405",
    name: "Kushal.C",
    phone: "8088019668",
    email: "kc2042527@gmail.com",
  },
  {
    usn: "1EW24AI407",
    name: "Prajwal.v",
    phone: "7829952004",
    email: "pv4031650@gmail.com",
  },
];

// ==========================================
// AIML TEACHERS DATA (From existing config)
// ==========================================
const aimlTeachers = [
  {
    name: "Neethu Mam",
    phone: "+91 88617 87272",
    subject: "Computer Network",
    subjectCode: "BCS502",
  },
  {
    name: "Divya Mam",
    phone: "+91 99016 00284",
    subject: "RM & IPR",
    subjectCode: "BRMK557",
  },
  {
    name: "Swaroop Sir",
    phone: "+91 95027 29320",
    subject: "DS",
    subjectCode: "BCS515",
  },
  {
    name: "Kavitha Mam",
    phone: "+91 94491 67219",
    subject: "SEPM",
    subjectCode: "BCS501",
  },
  {
    name: "Pawan Raj Sir",
    phone: "+91 80731 01304",
    subject: "Data Visualization",
    subjectCode: "BAIL504",
  },
  {
    name: "Usha Mam",
    phone: "+91 96630 75706",
    subject: null,
    subjectCode: null,
    isClassTeacher: true,
  },
  {
    name: "Sunanda Mam",
    phone: "+91 90082 68555",
    subject: "EVS",
    subjectCode: "BCS508",
  },
];

// ==========================================
// CSE FAKE DATA
// ==========================================
const cseStudents = [
  {
    usn: "1EW23CS001",
    name: "Aditya Kumar",
    phone: "9876543210",
    email: "aditya.kumar@gmail.com",
  },
  {
    usn: "1EW23CS002",
    name: "Bharat Singh",
    phone: "9876543211",
    email: "bharat.singh@gmail.com",
  },
  {
    usn: "1EW23CS003",
    name: "Chandan R",
    phone: "9876543212",
    email: "chandan.r@gmail.com",
  },
  {
    usn: "1EW23CS004",
    name: "Deepak M",
    phone: "9876543213",
    email: "deepak.m@gmail.com",
  },
  {
    usn: "1EW23CS005",
    name: "Esha Patil",
    phone: "9876543214",
    email: "esha.patil@gmail.com",
  },
  {
    usn: "1EW23CS006",
    name: "Farhan Ahmed",
    phone: "9876543215",
    email: "farhan.ahmed@gmail.com",
  },
  {
    usn: "1EW23CS007",
    name: "Gautam Reddy",
    phone: "9876543216",
    email: "gautam.reddy@gmail.com",
  },
  {
    usn: "1EW23CS008",
    name: "Harsha K",
    phone: "9876543217",
    email: "harsha.k@gmail.com",
  },
  {
    usn: "1EW23CS009",
    name: "Ishita Sharma",
    phone: "9876543218",
    email: "ishita.sharma@gmail.com",
  },
  {
    usn: "1EW23CS010",
    name: "Jayesh P",
    phone: "9876543219",
    email: "jayesh.p@gmail.com",
  },
  {
    usn: "1EW23CS011",
    name: "Kavya N",
    phone: "9876543220",
    email: "kavya.n@gmail.com",
  },
  {
    usn: "1EW23CS012",
    name: "Lakshmi Priya",
    phone: "9876543221",
    email: "lakshmi.priya@gmail.com",
  },
  {
    usn: "1EW23CS013",
    name: "Manoj Kumar",
    phone: "9876543222",
    email: "manoj.kumar@gmail.com",
  },
  {
    usn: "1EW23CS014",
    name: "Navya S",
    phone: "9876543223",
    email: "navya.s@gmail.com",
  },
  {
    usn: "1EW23CS015",
    name: "Om Prakash",
    phone: "9876543224",
    email: "om.prakash@gmail.com",
  },
  {
    usn: "1EW23CS016",
    name: "Priya Hegde",
    phone: "9876543225",
    email: "priya.hegde@gmail.com",
  },
  {
    usn: "1EW23CS017",
    name: "Qasim Khan",
    phone: "9876543226",
    email: "qasim.khan@gmail.com",
  },
  {
    usn: "1EW23CS018",
    name: "Rahul Gowda",
    phone: "9876543227",
    email: "rahul.gowda@gmail.com",
  },
  {
    usn: "1EW23CS019",
    name: "Sneha M",
    phone: "9876543228",
    email: "sneha.m@gmail.com",
  },
  {
    usn: "1EW23CS020",
    name: "Tejas A",
    phone: "9876543229",
    email: "tejas.a@gmail.com",
  },
  {
    usn: "1EW23CS021",
    name: "Uma Shankar",
    phone: "9876543230",
    email: "uma.shankar@gmail.com",
  },
  {
    usn: "1EW23CS022",
    name: "Vijay Kumar",
    phone: "9876543231",
    email: "vijay.kumar@gmail.com",
  },
  {
    usn: "1EW23CS023",
    name: "Waseem R",
    phone: "9876543232",
    email: "waseem.r@gmail.com",
  },
  {
    usn: "1EW23CS024",
    name: "Xena Bhat",
    phone: "9876543233",
    email: "xena.bhat@gmail.com",
  },
  {
    usn: "1EW23CS025",
    name: "Yashwanth S",
    phone: "9876543234",
    email: "yashwanth.s@gmail.com",
  },
  {
    usn: "1EW23CS026",
    name: "Zara Sheikh",
    phone: "9876543235",
    email: "zara.sheikh@gmail.com",
  },
  {
    usn: "1EW23CS027",
    name: "Arjun V",
    phone: "9876543236",
    email: "arjun.v@gmail.com",
  },
  {
    usn: "1EW23CS028",
    name: "Bindu K",
    phone: "9876543237",
    email: "bindu.k@gmail.com",
  },
  {
    usn: "1EW23CS029",
    name: "Chirag M",
    phone: "9876543238",
    email: "chirag.m@gmail.com",
  },
  {
    usn: "1EW23CS030",
    name: "Divya P",
    phone: "9876543239",
    email: "divya.p@gmail.com",
  },
];

const cseTeachers = [
  {
    name: "Dr. Ramesh Kumar",
    phone: "+91 98765 43210",
    subject: "Data Structures",
    subjectCode: "BCS301",
  },
  {
    name: "Prof. Anita Sharma",
    phone: "+91 98765 43211",
    subject: "Database Systems",
    subjectCode: "BCS302",
  },
  {
    name: "Dr. Suresh Babu",
    phone: "+91 98765 43212",
    subject: "Operating Systems",
    subjectCode: "BCS303",
  },
  {
    name: "Prof. Meena R",
    phone: "+91 98765 43213",
    subject: "Computer Networks",
    subjectCode: "BCS304",
    isClassTeacher: true,
  },
  {
    name: "Dr. Prakash N",
    phone: "+91 98765 43214",
    subject: "Software Engineering",
    subjectCode: "BCS305",
  },
];

// ==========================================
// AIDS FAKE DATA
// ==========================================
const aidsStudents = [
  {
    usn: "1EW23AD001",
    name: "Akhil Reddy",
    phone: "9988776655",
    email: "akhil.reddy@gmail.com",
  },
  {
    usn: "1EW23AD002",
    name: "Bhoomika S",
    phone: "9988776656",
    email: "bhoomika.s@gmail.com",
  },
  {
    usn: "1EW23AD003",
    name: "Chaitanya K",
    phone: "9988776657",
    email: "chaitanya.k@gmail.com",
  },
  {
    usn: "1EW23AD004",
    name: "Dhruv Patel",
    phone: "9988776658",
    email: "dhruv.patel@gmail.com",
  },
  {
    usn: "1EW23AD005",
    name: "Eshwar M",
    phone: "9988776659",
    email: "eshwar.m@gmail.com",
  },
  {
    usn: "1EW23AD006",
    name: "Fathima N",
    phone: "9988776660",
    email: "fathima.n@gmail.com",
  },
  {
    usn: "1EW23AD007",
    name: "Ganesh R",
    phone: "9988776661",
    email: "ganesh.r@gmail.com",
  },
  {
    usn: "1EW23AD008",
    name: "Harini V",
    phone: "9988776662",
    email: "harini.v@gmail.com",
  },
  {
    usn: "1EW23AD009",
    name: "Irfan Khan",
    phone: "9988776663",
    email: "irfan.khan@gmail.com",
  },
  {
    usn: "1EW23AD010",
    name: "Jyothi P",
    phone: "9988776664",
    email: "jyothi.p@gmail.com",
  },
  {
    usn: "1EW23AD011",
    name: "Kiran Kumar",
    phone: "9988776665",
    email: "kiran.kumar@gmail.com",
  },
  {
    usn: "1EW23AD012",
    name: "Lakshman S",
    phone: "9988776666",
    email: "lakshman.s@gmail.com",
  },
  {
    usn: "1EW23AD013",
    name: "Meghana R",
    phone: "9988776667",
    email: "meghana.r@gmail.com",
  },
  {
    usn: "1EW23AD014",
    name: "Nitin Gowda",
    phone: "9988776668",
    email: "nitin.gowda@gmail.com",
  },
  {
    usn: "1EW23AD015",
    name: "Omkar B",
    phone: "9988776669",
    email: "omkar.b@gmail.com",
  },
  {
    usn: "1EW23AD016",
    name: "Pooja H",
    phone: "9988776670",
    email: "pooja.h@gmail.com",
  },
  {
    usn: "1EW23AD017",
    name: "Qureshi Imran",
    phone: "9988776671",
    email: "qureshi.imran@gmail.com",
  },
  {
    usn: "1EW23AD018",
    name: "Rakesh T",
    phone: "9988776672",
    email: "rakesh.t@gmail.com",
  },
  {
    usn: "1EW23AD019",
    name: "Sahithi D",
    phone: "9988776673",
    email: "sahithi.d@gmail.com",
  },
  {
    usn: "1EW23AD020",
    name: "Tanvi M",
    phone: "9988776674",
    email: "tanvi.m@gmail.com",
  },
  {
    usn: "1EW23AD021",
    name: "Uday Kumar",
    phone: "9988776675",
    email: "uday.kumar@gmail.com",
  },
  {
    usn: "1EW23AD022",
    name: "Varun J",
    phone: "9988776676",
    email: "varun.j@gmail.com",
  },
  {
    usn: "1EW23AD023",
    name: "Wasim A",
    phone: "9988776677",
    email: "wasim.a@gmail.com",
  },
  {
    usn: "1EW23AD024",
    name: "Yamini K",
    phone: "9988776678",
    email: "yamini.k@gmail.com",
  },
  {
    usn: "1EW23AD025",
    name: "Zayed Khan",
    phone: "9988776679",
    email: "zayed.khan@gmail.com",
  },
  {
    usn: "1EW23AD026",
    name: "Ananya S",
    phone: "9988776680",
    email: "ananya.s@gmail.com",
  },
  {
    usn: "1EW23AD027",
    name: "Bharath R",
    phone: "9988776681",
    email: "bharath.r@gmail.com",
  },
  {
    usn: "1EW23AD028",
    name: "Chaitra M",
    phone: "9988776682",
    email: "chaitra.m@gmail.com",
  },
  {
    usn: "1EW23AD029",
    name: "Darshan P",
    phone: "9988776683",
    email: "darshan.p@gmail.com",
  },
  {
    usn: "1EW23AD030",
    name: "Eesha N",
    phone: "9988776684",
    email: "eesha.n@gmail.com",
  },
];

const aidsTeachers = [
  {
    name: "Dr. Sanjay M",
    phone: "+91 99887 76655",
    subject: "Data Science Fundamentals",
    subjectCode: "BAD301",
  },
  {
    name: "Prof. Rekha S",
    phone: "+91 99887 76656",
    subject: "Machine Learning",
    subjectCode: "BAD302",
  },
  {
    name: "Dr. Karthik R",
    phone: "+91 99887 76657",
    subject: "Statistical Analysis",
    subjectCode: "BAD303",
  },
  {
    name: "Prof. Swathi N",
    phone: "+91 99887 76658",
    subject: "Big Data Analytics",
    subjectCode: "BAD304",
    isClassTeacher: true,
  },
  {
    name: "Dr. Mohan K",
    phone: "+91 99887 76659",
    subject: "Deep Learning",
    subjectCode: "BAD305",
  },
];

// ==========================================
// SESSION TOPICS
// ==========================================
const sessionTopics = {
  CSE: [
    "Arrays and Linked Lists",
    "Stacks and Queues",
    "Trees and BST",
    "Graph Algorithms",
    "Sorting Algorithms",
    "Dynamic Programming",
    "SQL Queries",
    "Normalization",
    "Process Management",
    "Memory Management",
    "File Systems",
    "OSI Model",
    "TCP/IP Protocol",
    "Network Security",
    "SDLC Models",
    "Agile Methodology",
    "Testing Strategies",
    "Version Control",
    "OOP Concepts",
    "Design Patterns",
    "Hash Tables",
    "Heap Data Structure",
    "Transactions in DBMS",
    "Deadlock Prevention",
    "Virtual Memory",
    "DNS and HTTP",
    "Firewall Concepts",
    "Code Review",
    "CI/CD Pipeline",
    "Cloud Computing Intro",
  ],
  AIDS: [
    "Introduction to Data Science",
    "Python for Data Science",
    "NumPy Arrays",
    "Pandas DataFrames",
    "Data Visualization with Matplotlib",
    "Statistical Measures",
    "Probability Distributions",
    "Hypothesis Testing",
    "Regression Analysis",
    "Classification Algorithms",
    "Decision Trees",
    "Random Forest",
    "Neural Networks Basics",
    "Gradient Descent",
    "Overfitting and Underfitting",
    "Cross Validation",
    "Feature Engineering",
    "Dimensionality Reduction",
    "PCA Analysis",
    "Clustering Algorithms",
    "K-Means Clustering",
    "Hadoop Basics",
    "Spark Introduction",
    "MapReduce Concept",
    "Data Warehousing",
    "ETL Process",
    "Time Series Analysis",
    "Natural Language Processing",
    "Text Mining",
    "Sentiment Analysis",
  ],
};

// ==========================================
// HELPER FUNCTIONS
// ==========================================
const getRandomInt = (min, max) =>
  Math.floor(Math.random() * (max - min + 1)) + min;

async function createStudents(studentsData, branch, classId) {
  const createdStudents = [];

  for (const s of studentsData) {
    try {
      const student = await User.create({
        name: s.name,
        email: s.email.toLowerCase(),
        phone: s.phone,
        role: "student",
        usn: s.usn,
        dateOfBirth: STUDENT_DOB,
        semester: SEMESTER,
        branch: branch,
        department: branch,
        section: "A",
        class: classId,
        isActive: true,
        first_login: true,
        biometricEnrolled: false,
      });
      createdStudents.push(student);
    } catch (err) {
      console.log(`   ⚠️ Skipped ${s.name} (${err.message})`);
    }
  }

  return createdStudents;
}

async function createTeachersAndSubjects(teachersData, branch) {
  const teacherPassword = await bcrypt.hash("Teacher@123", 12);
  const createdTeachers = [];
  const createdSubjects = [];
  let classTeacher = null;

  // Create subjects first
  for (const t of teachersData) {
    if (t.subject && t.subjectCode) {
      try {
        const subject = await Subject.create({
          subjectName: t.subject,
          subjectCode: t.subjectCode,
          semester: SEMESTER,
          department: branch,
          credits: 3,
          isActive: true,
        });
        createdSubjects.push(subject);
      } catch (err) {
        console.log(`   ⚠️ Subject ${t.subjectCode} already exists`);
        const existing = await Subject.findOne({ subjectCode: t.subjectCode });
        if (existing) createdSubjects.push(existing);
      }
    }
  }

  // Create teachers
  for (let i = 0; i < teachersData.length; i++) {
    const t = teachersData[i];
    const nameParts = t.name.toLowerCase().replace(/\s+/g, " ").split(" ");
    const firstName = nameParts[0].replace(/[^a-z]/g, "");

    try {
      const teacher = await User.create({
        name: t.name,
        email: `${firstName}.${branch.toLowerCase()}${i}@attendsmart.com`,
        phone: t.phone,
        whatsapp: t.phone,
        password: teacherPassword,
        role: "teacher",
        isActive: true,
        employeeId: `${branch}${String(i + 1).padStart(3, "0")}`,
        department: branch,
      });

      createdTeachers.push({
        ...teacher.toObject(),
        subject: t.subject,
        subjectCode: t.subjectCode,
        isClassTeacher: t.isClassTeacher || false,
      });

      if (t.isClassTeacher) {
        classTeacher = teacher;
      }

      console.log(`   ✅ ${t.name} (${teacher.email})`);
    } catch (err) {
      console.log(`   ⚠️ Skipped teacher ${t.name} (${err.message})`);
    }
  }

  return { createdTeachers, createdSubjects, classTeacher };
}

async function createSessionsAndAttendance(
  classDoc,
  teachers,
  subjects,
  topics,
  studentIds
) {
  console.log(
    `\n📅 Creating sessions and attendance for ${classDoc.className}...`
  );

  const now = new Date();
  let totalSessions = 0;
  let totalAttendance = 0;

  // Create 30 sessions over the past month
  for (let i = 0; i < 30; i++) {
    const daysAgo = i + 1;
    const sessionDate = new Date(now);
    sessionDate.setDate(sessionDate.getDate() - daysAgo);
    sessionDate.setHours(9 + getRandomInt(0, 5), getRandomInt(0, 59), 0, 0);

    const endTime = new Date(sessionDate);
    endTime.setMinutes(endTime.getMinutes() + 60);

    // Pick a random teacher with a subject
    const teachersWithSubjects = teachers.filter((t) => t.subjectCode);
    const randomTeacher = teachersWithSubjects[i % teachersWithSubjects.length];

    const session = await Session.create({
      class: classDoc._id,
      teacher: randomTeacher._id,
      sessionType: "lecture",
      topic: topics[i % topics.length],
      startTime: sessionDate,
      endTime: endTime,
      duration: 60,
      location: {
        room: `Room ${getRandomInt(101, 110)}`,
        building: "Main Block",
        floor: "1st Floor",
        coordinates: {
          latitude: 12.9716,
          longitude: 77.5946,
          radius: 100,
        },
      },
      status: "completed",
      expectedStudents: studentIds.length,
      presentCount: 0,
      absentCount: 0,
      attendancePercentage: 0,
      completedAt: endTime,
    });

    totalSessions++;

    // Create attendance records
    const attendanceRecords = [];
    for (const studentId of studentIds) {
      // 75-90% attendance rate (random)
      const attendanceRate = 0.75 + Math.random() * 0.15;
      const isPresent = Math.random() < attendanceRate;
      const checkInTime = isPresent
        ? new Date(sessionDate.getTime() + getRandomInt(0, 15) * 60000)
        : null;

      const attendanceData = {
        session: session._id,
        student: studentId,
        class: classDoc._id,
        status: isPresent ? "present" : "absent",
        checkInTime: checkInTime,
        verificationSteps: isPresent
          ? {
              gpsCompleted: true,
              bleCompleted: true,
              biometricCompleted: true,
            }
          : {
              gpsCompleted: false,
              bleCompleted: false,
              biometricCompleted: false,
            },
        verificationData: isPresent
          ? {
              gps: {
                verified: true,
                latitude: 12.9716 + (Math.random() - 0.5) * 0.001,
                longitude: 77.5946 + (Math.random() - 0.5) * 0.001,
                accuracy: getRandomInt(5, 15),
                distance: getRandomInt(5, 50),
                timestamp: checkInTime,
              },
              ble: {
                verified: true,
                deviceId: `BEACON-${classDoc.className.replace(/\s/g, "-")}`,
                rssi: getRandomInt(-70, -45),
                distance: getRandomInt(1, 8),
                timestamp: checkInTime,
              },
              biometric: {
                verified: true,
                type: "face",
                confidence: getRandomInt(85, 99),
                timestamp: checkInTime,
              },
            }
          : {},
        isVerified: isPresent,
        verificationScore: isPresent ? getRandomInt(75, 100) : 0,
        hasAlert: false,
      };

      attendanceRecords.push(attendanceData);
    }

    // Insert attendance (ignore duplicates)
    try {
      await Attendance.insertMany(attendanceRecords, { ordered: false });
      totalAttendance += attendanceRecords.length;
    } catch (err) {
      if (err.code !== 11000) {
        console.error(`   ⚠️ Attendance error: ${err.message}`);
      }
    }

    // Update session stats
    const presentCount = attendanceRecords.filter(
      (a) => a.status === "present"
    ).length;
    session.presentCount = presentCount;
    session.absentCount = studentIds.length - presentCount;
    session.attendancePercentage = Math.round(
      (presentCount / studentIds.length) * 100
    );
    await session.save();
  }

  console.log(
    `   ✅ Created ${totalSessions} sessions with ${totalAttendance} attendance records`
  );
  return { totalSessions, totalAttendance };
}

// ==========================================
// MAIN SEEDING FUNCTION
// ==========================================
async function seedCompleteData() {
  try {
    console.log("🔄 Connecting to MongoDB...");
    if (!process.env.MONGODB_URI) {
      throw new Error("MONGODB_URI is not defined in .env");
    }
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ MongoDB Connected\n");

    // ==========================================
    // STEP 1: CLEAR EXISTING DATA
    // ==========================================
    console.log("🗑️  Clearing existing data...");
    await Attendance.deleteMany({});
    await Session.deleteMany({});
    await Class.deleteMany({});
    await Subject.deleteMany({});
    await User.deleteMany({ role: { $in: ["student", "teacher"] } });
    console.log(
      "✅ Cleared all existing students, teachers, classes, sessions, and attendance\n"
    );

    // ==========================================
    // STEP 2: CREATE AIML CLASS
    // ==========================================
    console.log("═══════════════════════════════════════");
    console.log("📚 CREATING AIML CLASS");
    console.log("═══════════════════════════════════════");

    // Create AIML teachers and subjects
    console.log("\n👨‍🏫 Creating AIML teachers...");
    const {
      createdTeachers: aimlTeacherDocs,
      createdSubjects: aimlSubjectDocs,
      classTeacher: aimlClassTeacher,
    } = await createTeachersAndSubjects(aimlTeachers, "AIML");

    // Create subject map
    const aimlSubjectMap = {};
    aimlSubjectDocs.forEach((s) => {
      aimlSubjectMap[s.subjectCode] = s._id;
    });

    // Create subject-teacher assignments
    const aimlSubjectTeachers = aimlTeacherDocs
      .filter((t) => t.subjectCode && aimlSubjectMap[t.subjectCode])
      .map((t) => ({
        teacher: t._id,
        subject: aimlSubjectMap[t.subjectCode],
        assignedDate: new Date(),
      }));

    // Create AIML class
    const aimlClass = await Class.create({
      className: "AIML 5th Semester - Section A",
      section: "A",
      academicYear: ACADEMIC_YEAR,
      department: "AIML",
      classTeacher: aimlClassTeacher ? aimlClassTeacher._id : null,
      subjectTeachers: aimlSubjectTeachers,
      students: [],
      totalStudents: 0,
      isActive: true,
      description: "AIML 5th Semester Class",
      courseCode: "AIML5-A",
    });

    // Create AIML students
    console.log("\n👨‍🎓 Creating AIML students...");
    const aimlStudentDocs = await createStudents(
      aimlStudents,
      "AIML",
      aimlClass._id
    );
    console.log(`   ✅ Created ${aimlStudentDocs.length} AIML students`);

    // Update class with students
    aimlClass.students = aimlStudentDocs.map((s) => ({
      studentId: s._id,
      usn: s.usn,
      name: s.name,
    }));
    aimlClass.totalStudents = aimlStudentDocs.length;
    await aimlClass.save();

    console.log(
      `\n✅ AIML class created with ${aimlStudentDocs.length} students and ${aimlTeacherDocs.length} teachers`
    );

    // ==========================================
    // STEP 3: CREATE CSE CLASS
    // ==========================================
    console.log("\n═══════════════════════════════════════");
    console.log("📚 CREATING CSE CLASS");
    console.log("═══════════════════════════════════════");

    // Create CSE teachers and subjects
    console.log("\n👨‍🏫 Creating CSE teachers...");
    const {
      createdTeachers: cseTeacherDocs,
      createdSubjects: cseSubjectDocs,
      classTeacher: cseClassTeacher,
    } = await createTeachersAndSubjects(cseTeachers, "CSE");

    // Create subject map
    const cseSubjectMap = {};
    cseSubjectDocs.forEach((s) => {
      cseSubjectMap[s.subjectCode] = s._id;
    });

    // Create subject-teacher assignments
    const cseSubjectTeachers = cseTeacherDocs
      .filter((t) => t.subjectCode && cseSubjectMap[t.subjectCode])
      .map((t) => ({
        teacher: t._id,
        subject: cseSubjectMap[t.subjectCode],
        assignedDate: new Date(),
      }));

    // Create CSE class
    const cseClass = await Class.create({
      className: "CSE 5th Semester - Section A",
      section: "A",
      academicYear: ACADEMIC_YEAR,
      department: "CSE",
      classTeacher: cseClassTeacher ? cseClassTeacher._id : null,
      subjectTeachers: cseSubjectTeachers,
      students: [],
      totalStudents: 0,
      isActive: true,
      description: "CSE 5th Semester Class",
      courseCode: "CSE5-A",
    });

    // Create CSE students
    console.log("\n👨‍🎓 Creating CSE students...");
    const cseStudentDocs = await createStudents(
      cseStudents,
      "CSE",
      cseClass._id
    );
    console.log(`   ✅ Created ${cseStudentDocs.length} CSE students`);

    // Update class with students
    cseClass.students = cseStudentDocs.map((s) => ({
      studentId: s._id,
      usn: s.usn,
      name: s.name,
    }));
    cseClass.totalStudents = cseStudentDocs.length;
    await cseClass.save();

    // Create sessions and attendance for CSE
    const cseSessionData = await createSessionsAndAttendance(
      cseClass,
      cseTeacherDocs,
      cseSubjectDocs,
      sessionTopics.CSE,
      cseStudentDocs.map((s) => s._id)
    );

    console.log(
      `\n✅ CSE class created with ${cseStudentDocs.length} students, ${cseTeacherDocs.length} teachers, ${cseSessionData.totalSessions} sessions`
    );

    // ==========================================
    // STEP 4: CREATE AIDS CLASS
    // ==========================================
    console.log("\n═══════════════════════════════════════");
    console.log("📚 CREATING AIDS CLASS");
    console.log("═══════════════════════════════════════");

    // Create AIDS teachers and subjects
    console.log("\n👨‍🏫 Creating AIDS teachers...");
    const {
      createdTeachers: aidsTeacherDocs,
      createdSubjects: aidsSubjectDocs,
      classTeacher: aidsClassTeacher,
    } = await createTeachersAndSubjects(aidsTeachers, "AIDS");

    // Create subject map
    const aidsSubjectMap = {};
    aidsSubjectDocs.forEach((s) => {
      aidsSubjectMap[s.subjectCode] = s._id;
    });

    // Create subject-teacher assignments
    const aidsSubjectTeachers = aidsTeacherDocs
      .filter((t) => t.subjectCode && aidsSubjectMap[t.subjectCode])
      .map((t) => ({
        teacher: t._id,
        subject: aidsSubjectMap[t.subjectCode],
        assignedDate: new Date(),
      }));

    // Create AIDS class
    const aidsClass = await Class.create({
      className: "AIDS 5th Semester - Section A",
      section: "A",
      academicYear: ACADEMIC_YEAR,
      department: "AIDS",
      classTeacher: aidsClassTeacher ? aidsClassTeacher._id : null,
      subjectTeachers: aidsSubjectTeachers,
      students: [],
      totalStudents: 0,
      isActive: true,
      description: "AIDS 5th Semester Class",
      courseCode: "AIDS5-A",
    });

    // Create AIDS students
    console.log("\n👨‍🎓 Creating AIDS students...");
    const aidsStudentDocs = await createStudents(
      aidsStudents,
      "AIDS",
      aidsClass._id
    );
    console.log(`   ✅ Created ${aidsStudentDocs.length} AIDS students`);

    // Update class with students
    aidsClass.students = aidsStudentDocs.map((s) => ({
      studentId: s._id,
      usn: s.usn,
      name: s.name,
    }));
    aidsClass.totalStudents = aidsStudentDocs.length;
    await aidsClass.save();

    // Create sessions and attendance for AIDS
    const aidsSessionData = await createSessionsAndAttendance(
      aidsClass,
      aidsTeacherDocs,
      aidsSubjectDocs,
      sessionTopics.AIDS,
      aidsStudentDocs.map((s) => s._id)
    );

    console.log(
      `\n✅ AIDS class created with ${aidsStudentDocs.length} students, ${aidsTeacherDocs.length} teachers, ${aidsSessionData.totalSessions} sessions`
    );

    // ==========================================
    // FINAL SUMMARY
    // ==========================================
    console.log(
      "\n═══════════════════════════════════════════════════════════"
    );
    console.log("✅ COMPLETE DATA SEEDING FINISHED!");
    console.log("═══════════════════════════════════════════════════════════");
    console.log("\n📊 SUMMARY:");
    console.log("───────────────────────────────────────────────────────────");
    console.log(
      `   AIML:  ${aimlStudentDocs.length} students, ${aimlTeacherDocs.length} teachers (NO sessions - data only)`
    );
    console.log(
      `   CSE:   ${cseStudentDocs.length} students, ${cseTeacherDocs.length} teachers, ${cseSessionData.totalSessions} sessions`
    );
    console.log(
      `   AIDS:  ${aidsStudentDocs.length} students, ${aidsTeacherDocs.length} teachers, ${aidsSessionData.totalSessions} sessions`
    );
    console.log("───────────────────────────────────────────────────────────");

    console.log("\n📋 TEACHER CREDENTIALS (Password: Teacher@123):");
    console.log("───────────────────────────────────────────────────────────");
    console.log("\n   AIML Teachers:");
    aimlTeacherDocs.forEach((t) => console.log(`      ${t.name}: ${t.email}`));
    console.log("\n   CSE Teachers:");
    cseTeacherDocs.forEach((t) => console.log(`      ${t.name}: ${t.email}`));
    console.log("\n   AIDS Teachers:");
    aidsTeacherDocs.forEach((t) => console.log(`      ${t.name}: ${t.email}`));

    console.log("\n📚 STUDENT LOGIN:");
    console.log("   Students login using USN + DOB (22-10-2005)");
    console.log(
      "═══════════════════════════════════════════════════════════\n"
    );

    process.exit(0);
  } catch (error) {
    console.error("❌ SEED ERROR:", error);
    process.exit(1);
  }
}

seedCompleteData();

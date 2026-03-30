//const mongoose = require("mongoose");

//module.exports = () => {
  //mongoose.connect("mongodb://127.0.0.1:27017/invoiceDB")
    //.then(() => console.log("MongoDB Connected"))
    //.catch(err => console.log(err));
//};
require("dotenv").config();

const mongoose = require("mongoose");

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("MongoDB Connected");
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

module.exports = connectDB;
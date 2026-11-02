require('dotenv').config();
const mongoose = require("mongoose");
const initData = require("./data.js");
const Listing = require("../models/listing.js");

const MONGO_URL = process.env.INIT_MONGO_URL;

main()
.then(async () => {
    console.log("Connected to DB");
    await initDB();
})
.catch((err) => console.log(err));

async function main(){
    await mongoose.connect(MONGO_URL);
}

const initDB = async () => {
    await Listing.deleteMany({});
    await Listing.insertMany(initData.data);
    console.log("data was initialized");
};


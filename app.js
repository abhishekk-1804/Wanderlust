require('dotenv').config();
const express = require("express");
const app = express();
const mongoose = require("mongoose");
const Listing = require("./models/listing.js");
const path = require("path");
const methodOverride = require("method-override");
const ejsMate = require("ejs-mate");
const wrapAsync = require("./utils/wrapAsync.js");
const ExpressError = require("./utils/ExpressError.js");
const { listingSchema, reviewSchema } = require("./schema.js");
const Review = require("./models/review.js");


const MONGO_URL = process.env.MONGO_URL;

// ---------- DB CONNECTION ----------
async function main(){
    await mongoose.connect(MONGO_URL);
}

main()
.then(() => {
    console.log("Connected to DB");
    app.listen(8080, () => {
        console.log("Server running on port 8080");
    });
})
.catch(err => console.log(err));


// ---------- MIDDLEWARE ----------
app.set("view engine", "ejs");
app.set("views", path.join(__dirname,"views"));
app.engine("ejs", ejsMate);

app.use(express.urlencoded({extended:true}));
app.use(methodOverride("_method"));
app.use(express.static(path.join(__dirname,"public")));


// ---------- ROUTES ----------

// ROOT
app.get("/", (req,res)=>{
    res.send("Hi I am root");
});




const validateListing = (req, res, next) => {
    const { error } = listingSchema.validate(req.body);

    if (error) {
        const errMsg = error.details.map(el => el.message).join(", ");
        return next(new ExpressError(errMsg, 400));
    }

    next();
};

const validateReview = (req, res, next) => {
    console.log("Review request body:", req.body);

    const { error } = reviewSchema.validate(req.body);

    if (error) {
        const errMsg = error.details.map(el => el.message).join(", ");
        return next(new ExpressError(errMsg, 400));
    }

    next();
};


// INDEX
app.get("/listings", async (req,res)=>{
    try{
        const allListings = await Listing.find({});
        res.render("listings/index",{allListings});
    }catch(err){
        console.log(err);
        res.send("Error loading listings");
    }
});


// NEW
app.get("/listings/new",(req,res)=>{
    res.render("listings/new");
});


// CREATE


app.post(
    "/listings", 
    validateListing,
    wrapAsync(async (req, res) => {
    const newListing = new Listing(req.body.listings);
    await newListing.save();
    res.redirect("/listings");
}));

// ---------- IMPORTANT ORDER ----------
// EDIT MUST COME BEFORE SHOW


// EDIT
app.get("/listings/:id/edit", wrapAsync(async (req,res,next)=>{
    try{
        const {id} = req.params;

        if(!mongoose.Types.ObjectId.isValid(id))
            return res.send("Invalid ID");

        const listing = await Listing.findById(id);
        if(!listing) return res.send("Listing not found");

        res.render("listings/edit",{listing});
    }
    catch(err){
        console.log(err);
        res.send("Edit error");
    }
}));


// UPDATE

app.put("/listings/:id",
    validateListing,
    wrapAsync(async (req, res) => {
    let { id } = req.params;

    await Listing.findByIdAndUpdate(id, req.body.listings);

    res.redirect(`/listings/${id}`);
}));


// DELETE
app.delete(
    "/listings/:id", 
    wrapAsync(async (req,res)=> {
        let {id} = req.params;
        let deletedListing = await Listing.findByIdAndDelete(id);
        console.log(deletedListing);
        res.redirect("/listings");
    })
);

//Reviews
//Post Review Route
app.post("/listings/:id/reviews",  validateReview, wrapAsync(async (req,res)=>{
    let listing = await Listing.findById(req.params.id);
    let newReview = new Review(req.body.review);

    listing.reviews.push(newReview);

    await newReview.save();
    await listing.save();

    res.redirect(`/listings/${listing._id}`);
}));

//Delete Review Route

app.delete(
    "/listings/:id/reviews/:reviewId",
    wrapAsync(async (req, res) => {
        const { id, reviewId } = req.params;

        // Remove the review reference from the listing
        await Listing.findByIdAndUpdate(id, {
            $pull: { reviews: reviewId }
        });

        // Delete the review document from MongoDB
        await Review.findByIdAndDelete(reviewId);

        // Return to the listing page
        res.redirect(`/listings/${id}`);
    })
);

// SHOW  â† ALWAYS LAST
app.get(
    "/listings/:id", 
    wrapAsync(async (req,res,next)=>{
    try{
        const {id} = req.params;

        if(!mongoose.Types.ObjectId.isValid(id))
            return res.send("Invalid ID");

        const listing = await Listing.findById(id).populate("reviews");
        if(!listing) return res.send("Listing not found");

        res.render("listings/show",{listing});
    }
    catch(err){
        console.log(err);
        res.send("Show failed");
    }
}));


// TEST ROUTE
app.get("/testListing", async (req,res)=>{
    const sample = new Listing({
        title:"Test Villa",
        description:"Nice place",
        price:1200,
        location:"Goa",
        country:"India"
    });

    await sample.save();
    res.send("Test listing saved");
});

app.all("/{*splat}", (req, res, next) => {
    next(new ExpressError("Page Not Found!", 404));
});

app.use((err, req, res, next) => {
    let { statusCode = 500, message = "Something went wrong!" } = err;
    res.status(statusCode).render("error.ejs", { message });
    //res.status(statusCode).send(message);
});


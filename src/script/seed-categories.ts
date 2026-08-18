import { db } from "@/db";
import { categories } from "@/db/schema";

const categoryNames = [
    "Music",
    "Gaming",
    "News",
    "Sports",
    "Entertainment",
    "Education",
    "Science & Technology",
    "Travel",
    "Fashion & Beauty",
    "Food & Cooking",
    "Health & Fitness",
    "Comedy",
    "Animation",
    "Art & Design",
    "Documentary",
    "Business & Finance",
    "Cars & Vehicles",
    "Kids & Family",
    "DIY & Crafts",
    "Photography",
    "Politics",
    "Religion & Spirituality",
    "Vlogging",
];

async function main() {
    console.log("Seeding categories...")
    try {
        const values=categoryNames.map((name)=>({name}))
        await db.insert(categories).values(values)
        console.log("Categories seeded successfully!")
    } catch (error) {
        console.error("Error seeding categories:", error)
        process.exit(1)
    }
}

main()
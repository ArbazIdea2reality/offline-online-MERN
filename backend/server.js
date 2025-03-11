const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const bodyParser = require("body-parser");

const app = express();
app.use(cors());
app.use(bodyParser.json());

// MongoDB Connection
mongoose.connect("mongodb://127.0.0.1:27017/syncDB")
.then(() => {
    console.log('Successfully connected to MongoDB');
})
.catch(err => {
    console.error("MongoDB connection error:", err);
    process.exit(1);
});

const db = mongoose.connection;
db.on("error", (err) => {
    console.error("MongoDB connection error:", err);
    process.exit(1);
});
db.on("disconnected", () => console.log("MongoDB disconnected"));
db.on("reconnected", () => console.log("MongoDB reconnected"));

// Schema
const DataSchema = new mongoose.Schema({
    id: String,
    value: String,
    updatedAt: Date,
    versions: [{ source: String, value: String, timestamp: Date }],
});

const CloudModel = mongoose.model("CloudData", DataSchema);

// **1. Push Local to Cloud**
app.post("/sync/push", async (req, res) => {
    const { data } = req.body;
    let changes = 0;
    
    for (let row of data) {
        const existingDoc = await CloudModel.findOne({ id: row.id });
        if (!existingDoc || existingDoc.updatedAt < row.updatedAt) {
            await CloudModel.updateOne({ id: row.id }, row, { upsert: true });
            changes++;
        }
    }
    
    res.json({ message: "Sync completed", changes });
});

// **2. Pull Cloud to Local**
app.post("/sync/pull", async (req, res) => {
    const { localIds } = req.body;
    const newRows = await CloudModel.find({ id: { $nin: localIds } });
    res.json(newRows);
});

// **3. Merge Conflict**
app.post("/sync/merge", async (req, res) => {
    const { data } = req.body;
    let changes = 0;
    
    for (let row of data) {
        const cloudRow = await CloudModel.findOne({ id: row.id });

        if (!cloudRow) {
            await CloudModel.create(row);
            changes++;
        } else if (row.updatedAt > cloudRow.updatedAt) {
            await CloudModel.updateOne({ id: row.id }, row);
            changes++;
        } else if (row.updatedAt < cloudRow.updatedAt) {
            // Keep cloud version (do nothing)
        } else {
            // Keep both versions
            await CloudModel.updateOne(
                { id: row.id },
                {
                    $push: {
                        versions: {
                            source: "local",
                            value: row.value,
                            timestamp: row.updatedAt,
                        },
                    },
                }
            );
            changes++;
        }
    }
    res.json({ message: "Merge Completed", changes });
});

// Add new endpoint to check conflicts
app.post("/sync/checkConflicts", async (req, res) => {
    const { data } = req.body;
    const conflicts = [];

    for (let row of data) {
        const cloudRow = await CloudModel.findOne({ id: row.id });
        if (cloudRow && cloudRow.value !== row.value) {
            conflicts.push({
                id: row.id,
                localValue: row.value,
                cloudValue: cloudRow.value,
                localUpdatedAt: row.updatedAt,
                cloudUpdatedAt: cloudRow.updatedAt
            });
        }
    }

    res.json({ conflicts });
});

// Add new endpoint to resolve conflicts
app.post("/sync/resolve", async (req, res) => {
    const { resolutions, localData } = req.body;
    const updatedData = [...localData];

    for (let resolution of resolutions) {
        const cloudRow = await CloudModel.findOne({ id: resolution.id });
        const localIndex = updatedData.findIndex(item => item.id === resolution.id);

        switch (resolution.resolution) {
            case 'local':
                // Keep local version, update cloud
                await CloudModel.updateOne({ id: resolution.id }, updatedData[localIndex]);
                break;

            case 'cloud':
                // Keep cloud version, update local
                updatedData[localIndex] = {
                    ...cloudRow.toObject(),
                    updatedAt: new Date()
                };
                break;

            case 'both':
                // Keep both versions by storing in the cloud
                await CloudModel.updateOne(
                    { id: resolution.id },
                    {
                        $push: {
                            versions: {
                                source: "local",
                                value: updatedData[localIndex].value,
                                timestamp: updatedData[localIndex].updatedAt
                            }
                        }
                    }
                );
                break;
        }
    }

    res.json({ message: "Conflicts resolved", updatedData });
});

// Start Server
app.listen(5000, () => console.log("Server running on port 5000"));

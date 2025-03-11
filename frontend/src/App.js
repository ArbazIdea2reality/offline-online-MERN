import React, { useState } from "react";
import axios from "axios";

const App = () => {
    const [localData, setLocalData] = useState([
        { id: "1", value: "A", updatedAt: new Date() },
        { id: "2", value: "B", updatedAt: new Date() },
        { id: "3", value: "C", updatedAt: new Date() },
    ]);
    const [newValue, setNewValue] = useState("");
    const [conflicts, setConflicts] = useState([]);
    const [showConflictModal, setShowConflictModal] = useState(false);

    const syncToCloud = async () => {
        try {
            const response = await axios.post("http://localhost:5000/sync/push", { data: localData });
            if (response.data.changes === 0) {
                alert("No changes to sync to cloud");
            } else {
                alert(`${response.data.changes} items synced to cloud!`);
            }
        } catch (error) {
            alert("Error syncing to cloud: " + error.message);
        }
    };

    const syncFromCloud = async () => {
        try {
            const localIds = localData.map((item) => item.id);
            const response = await axios.post("http://localhost:5000/sync/pull", { localIds });
            
            if (response.data.length === 0) {
                alert("No new data available from cloud");
                return;
            }
            
            setLocalData([...localData, ...response.data]);
            alert(`${response.data.length} new items pulled from cloud!`);
        } catch (error) {
            alert("Error syncing from cloud: " + error.message);
        }
    };

    const mergeSync = async () => {
        try {
            // First, get conflicts
            const response = await axios.post("http://localhost:5000/sync/checkConflicts", { data: localData });
            
            if (response.data.conflicts.length === 0) {
                alert("No conflicts to resolve");
                return;
            }

            // Set conflicts and show modal
            setConflicts(response.data.conflicts);
            setShowConflictModal(true);
        } catch (error) {
            alert("Error checking conflicts: " + error.message);
        }
    };

    const resolveConflict = async (resolutions) => {
        try {
            const response = await axios.post("http://localhost:5000/sync/resolve", {
                resolutions,
                localData
            });
            setShowConflictModal(false);
            setConflicts([]);
            // Update local data with resolved data
            setLocalData(response.data.updatedData);
            alert("Conflicts resolved successfully!");
        } catch (error) {
            alert("Error resolving conflicts: " + error.message);
        }
    };

    const ConflictModal = () => {
        if (!showConflictModal) return null;

        return (
            <div style={modalStyle}>
                <div style={modalContent}>
                    <h3>Resolve Conflicts</h3>
                    <table style={{ width: "100%", marginBottom: "20px" }}>
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>Local Value</th>
                                <th>Cloud Value</th>
                                <th>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {conflicts.map((conflict) => (
                                <tr key={conflict.id}>
                                    <td>{conflict.id}</td>
                                    <td>{conflict.localValue}</td>
                                    <td>{conflict.cloudValue}</td>
                                    <td>
                                        <select 
                                            onChange={(e) => {
                                                conflict.resolution = e.target.value;
                                            }}
                                            defaultValue=""
                                        >
                                            <option value="" disabled>Choose...</option>
                                            <option value="local">Keep Local</option>
                                            <option value="cloud">Keep Cloud</option>
                                            <option value="both">Keep Both</option>
                                        </select>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    <button onClick={() => resolveConflict(conflicts)}>
                        Resolve Conflicts
                    </button>
                    <button onClick={() => setShowConflictModal(false)}>
                        Cancel
                    </button>
                </div>
            </div>
        );
    };

    const addNewData = () => {
        if (!newValue.trim()) return;
        const newItem = {
            id: Date.now().toString(),
            value: newValue,
            updatedAt: new Date()
        };
        setLocalData([...localData, newItem]);
        setNewValue("");
    };

    return (
        <div style={{ padding: "20px" }}>
            <h2>Data Sync Management</h2>
            
            {/* Add new data section */}
            <div style={{ marginBottom: "20px" }}>
                <input 
                    type="text" 
                    value={newValue}
                    onChange={(e) => setNewValue(e.target.value)}
                    placeholder="Enter new value"
                    style={{ padding: "5px", marginRight: "10px" }}
                />
                <button onClick={addNewData}>Add New Data</button>
            </div>

            {/* Sync buttons */}
            <div style={{ marginBottom: "20px" }}>
                <button onClick={syncToCloud} style={{ marginRight: "10px" }}>Sync to Cloud</button>
                <button onClick={syncFromCloud} style={{ marginRight: "10px" }}>Sync from Cloud</button>
                <button onClick={mergeSync}>Merge Sync</button>
            </div>

            {/* Data table */}
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                    <tr>
                        <th style={tableHeaderStyle}>ID</th>
                        <th style={tableHeaderStyle}>Value</th>
                        <th style={tableHeaderStyle}>Last Updated</th>
                    </tr>
                </thead>
                <tbody>
                    {localData.map((item) => (
                        <tr key={item.id}>
                            <td style={tableCellStyle}>{item.id}</td>
                            <td style={tableCellStyle}>{item.value}</td>
                            <td style={tableCellStyle}>
                                {new Date(item.updatedAt).toLocaleString()}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
            <ConflictModal />
        </div>
    );
};

const tableHeaderStyle = {
    backgroundColor: "#f4f4f4",
    padding: "10px",
    border: "1px solid #ddd",
    textAlign: "left"
};

const tableCellStyle = {
    padding: "8px",
    border: "1px solid #ddd"
};

const modalStyle = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
};

const modalContent = {
    backgroundColor: 'white',
    padding: '20px',
    borderRadius: '5px',
    maxWidth: '800px',
    width: '90%'
};

export default App;

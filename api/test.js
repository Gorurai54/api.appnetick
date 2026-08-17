const { dataDB, usersDB } = require("../lib/firebase");

module.exports = async (req, res) => {

    try {

        // App Update data
        const updateSnapshot = await dataDB
            .ref("AppUpdate")
            .once("value");

        // Users data
        const usersSnapshot = await usersDB
            .ref("Users")
            .once("value");

        const usersData = usersSnapshot.val() || {};

        const users = Object.keys(usersData).map(uid => {

            const user = usersData[uid] || {};

            return {
                uid: user.uid || uid,
                username: user.Username || "",
                avatar: user.avatar || ""
            };

        });

        res.status(200).json({
            success: true,
            firebase: "connected",

            data: updateSnapshot.val(),

            users: users
        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            success: false,
            error: error.message
        });

    }
};

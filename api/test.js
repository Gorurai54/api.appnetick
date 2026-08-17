const { dataDB } = require("../lib/firebase");

module.exports = async (req, res) => {

    try {

        const snapshot = await dataDB
            .ref("AppUpdate")
            .once("value");

        res.status(200).json({
            success: true,
            firebase: "connected",
            data: snapshot.val()
        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

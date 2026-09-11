const crypto = require("crypto");

const cors = require("../../../lib/cors");
const {
    createAdminToken
} = require("../../../lib/adminAuth");

module.exports = async function handler(req, res) {

    // CORS
    if (cors(req, res)) {
        return;
    }


    // Only POST
    if (req.method !== "POST") {

        return res.status(405).json({
            error: "Method not allowed"
        });

    }


    try {

        const adminPassword =
            process.env.VERIFICATION_ADMIN_PASSWORD;


        if (!adminPassword) {

            console.error(
                "VERIFICATION_ADMIN_PASSWORD is missing"
            );

            return res.status(500).json({
                error:
                    "Admin password is not configured on server."
            });

        }


        let body = req.body;


        if (typeof body === "string") {

            try {
                body = JSON.parse(body);
            } catch (e) {
                body = {};
            }

        }


        const password =
            body &&
            typeof body.password === "string"
                ? body.password
                : "";


        if (!password) {

            return res.status(400).json({
                error:
                    "Password is required."
            });

        }


        /*
         * Constant-time comparison
         */

        const passwordBuffer =
            Buffer.from(password);

        const correctBuffer =
            Buffer.from(adminPassword);


        let passwordCorrect = false;


        if (
            passwordBuffer.length ===
            correctBuffer.length
        ) {

            passwordCorrect =
                crypto.timingSafeEqual(
                    passwordBuffer,
                    correctBuffer
                );

        }


        if (!passwordCorrect) {

            return res.status(401).json({
                error:
                    "Invalid admin password."
            });

        }


        /*
         * Create short-lived admin token
         */

        const token =
            createAdminToken();


        return res.status(200).json({

            success: true,

            token: token,

            expiresIn: 7200

        });


    } catch (error) {

        console.error(
            "ADMIN LOGIN ERROR:",
            error
        );


        return res.status(500).json({
            error:
                "Internal server error."
        });

    }

};

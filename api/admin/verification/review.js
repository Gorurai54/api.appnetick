const {
    dataDB,
    usersDB
} = require("../../../lib/firebase");

const {
    requireAdmin
} = require("../../../lib/adminAuth");

const cors = require("../../../lib/cors");


module.exports = async function handler(req, res) {

    // =====================================================
    // CORS
    // IMPORTANT:
    // This must run BEFORE method checking.
    // It handles browser OPTIONS preflight.
    // =====================================================

    if (cors(req, res)) {
        return;
    }


    // =====================================================
    // METHOD
    // =====================================================

    if (req.method !== "POST") {

        return res
            .status(405)
            .json({
                success: false,
                error: "Method not allowed"
            });
    }


    // =====================================================
    // ADMIN AUTH
    // =====================================================

    if (!requireAdmin(req, res)) {
        return;
    }


    try {

        const body =
            req.body || {};


        // =================================================
        // INPUT
        // =================================================

        const uid =
            typeof body.uid === "string"
                ? body.uid.trim()
                : "";


        const action =
            typeof body.action === "string"
                ? body.action.trim().toLowerCase()
                : "";


        const reason =
            typeof body.reason === "string"
                ? body.reason.trim()
                : "";


        // =================================================
        // UID VALIDATION
        // =================================================

        if (!uid) {

            return res
                .status(400)
                .json({
                    success: false,
                    error: "UID is required."
                });
        }


        // Firebase key safety

        if (
            uid.includes(".") ||
            uid.includes("#") ||
            uid.includes("$") ||
            uid.includes("[") ||
            uid.includes("]")
        ) {

            return res
                .status(400)
                .json({
                    success: false,
                    error: "Invalid UID."
                });
        }


        // =================================================
        // ACTION VALIDATION
        // =================================================

        if (
            action !== "approve" &&
            action !== "reject"
        ) {

            return res
                .status(400)
                .json({
                    success: false,
                    error: "Invalid action."
                });
        }


        // =================================================
        // REJECTION REASON
        // =================================================

        if (
            action === "reject" &&
            !reason
        ) {

            return res
                .status(400)
                .json({
                    success: false,
                    error:
                        "Decline reason is required."
                });
        }


        // =================================================
        // VERIFICATION REQUEST
        // =================================================

        const requestRef =
            dataDB.ref(
                `VerificationRequests/${uid}`
            );


        const requestSnapshot =
            await requestRef.once("value");


        if (!requestSnapshot.exists()) {

            return res
                .status(404)
                .json({
                    success: false,
                    error:
                        "Verification request not found."
                });
        }


        const requestData =
            requestSnapshot.val() || {};


        // =================================================
        // CURRENT STATUS
        // =================================================

        const currentStatus =
            String(
                requestData.verification_status || ""
            )
            .toLowerCase()
            .trim();


        // Don't process already reviewed requests

        if (
            currentStatus === "approved" ||
            currentStatus === "rejected"
        ) {

            return res
                .status(409)
                .json({
                    success: false,
                    error:
                        `This verification request is already ${currentStatus}.`
                });
        }


        // =================================================
        // USER
        // =================================================

        const userRef =
            usersDB.ref(
                `Users/${uid}`
            );


        const userSnapshot =
            await userRef.once("value");


        if (!userSnapshot.exists()) {

            return res
                .status(404)
                .json({
                    success: false,
                    error:
                        "User account not found."
                });
        }


        const now =
            Date.now();


        // =================================================
        // APPROVE
        // =================================================

        if (action === "approve") {

            // ---------------------------------------------
            // Verification request
            // ---------------------------------------------

            await requestRef.update({

                verification_status:
                    "approved",

                reviewed_at:
                    now,

                reviewed_by:
                    "verification_admin",

                rejection_reason:
                    ""

            });


            // ---------------------------------------------
            // User account
            // ---------------------------------------------

            await userRef.update({

                // Current badge flag
                verified:
                    true,

                // Android compatibility
                verify:
                    true,

                verification_status:
                    "approved",

                verification_verified_at:
                    now

            });


            return res
                .status(200)
                .json({

                    success: true,

                    status:
                        "approved",

                    message:
                        "Verification approved successfully."

                });
        }


        // =================================================
        // REJECT
        // =================================================

        await requestRef.update({

            verification_status:
                "rejected",

            rejection_reason:
                reason,

            reviewed_at:
                now,

            reviewed_by:
                "verification_admin"

        });


        await userRef.update({

            verified:
                false,

            verify:
                false,

            verification_status:
                "rejected",

            verification_rejected_at:
                now

        });


        return res
            .status(200)
            .json({

                success: true,

                status:
                    "rejected",

                message:
                    "Verification request rejected."

            });


    } catch (error) {

        console.error(
            "Verification review error:",
            error
        );


        return res
            .status(500)
            .json({

                success: false,

                error:
                    "Unable to update verification request."

            });
    }
};

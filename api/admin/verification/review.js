const {
    dataDB,
    usersDB
} = require("../../../lib/firebase");

const {
    requireAdmin
} = require("../../../lib/adminAuth");


module.exports = async function handler(req, res) {

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

        const body = req.body || {};


        // =====================================================
        // INPUT
        // =====================================================

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


        // =====================================================
        // VALIDATE UID
        // =====================================================

        if (!uid) {

            return res
                .status(400)
                .json({
                    success: false,
                    error: "UID is required."
                });
        }


        // Firebase path safety

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


        // =====================================================
        // VALIDATE ACTION
        // =====================================================

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


        // =====================================================
        // REJECTION REASON
        // =====================================================

        if (
            action === "reject" &&
            !reason
        ) {

            return res
                .status(400)
                .json({
                    success: false,
                    error: "Decline reason is required."
                });
        }


        // =====================================================
        // LOAD VERIFICATION REQUEST
        // =====================================================

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


        // =====================================================
        // CHECK CURRENT STATUS
        // =====================================================

        const currentStatus =
            String(
                requestData.verification_status || ""
            ).toLowerCase();


        // Prevent approving/rejecting an already
        // completed request accidentally.

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


        // =====================================================
        // CHECK USER EXISTS
        // =====================================================

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


        const now = Date.now();


        // =====================================================
        // APPROVE
        // =====================================================

        if (action === "approve") {

            /*
             * Update both locations.
             *
             * DataApp:
             * VerificationRequests/{uid}
             *
             * Users DB:
             * Users/{uid}
             */

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


            await userRef.update({

                // Main verification badge flag
                verified:
                    true,

                // Compatibility with Android app
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


        // =====================================================
        // REJECT
        // =====================================================

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

const {
    dataDB,
    usersDB
} = require("../../../lib/firebase");


const {
    requireAdmin
} = require("../../../lib/adminAuth");


export default async function handler(
    req,
    res
) {

    if (
        req.method !==
        "POST"
    ) {

        return res
            .status(405)
            .json({
                success:false,
                error:
                    "Method not allowed"
            });
    }


    if (
        !requireAdmin(
            req,
            res
        )
    ) {

        return;
    }


    try {

        const body =
            req.body || {};


        const uid =
            typeof body.uid ===
            "string"
                ? body.uid.trim()
                : "";


        const action =
            typeof body.action ===
            "string"
                ? body.action
                : "";


        const reason =
            typeof body.reason ===
            "string"
                ? body.reason.trim()
                : "";


        if (!uid) {

            return res
                .status(400)
                .json({
                    success:false,
                    error:
                        "UID is required."
                });
        }


        if (
            action !== "approve" &&
            action !== "reject"
        ) {

            return res
                .status(400)
                .json({
                    success:false,
                    error:
                        "Invalid action."
                });
        }


        if (
            action === "reject" &&
            !reason
        ) {

            return res
                .status(400)
                .json({
                    success:false,
                    error:
                        "Decline reason is required."
                });
        }


        const requestRef =
            dataDB.ref(
                `VerificationRequests/${uid}`
            );


        const snapshot =
            await requestRef
                .once(
                    "value"
                );


        if (
            !snapshot.exists()
        ) {

            return res
                .status(404)
                .json({
                    success:false,
                    error:
                        "Verification request not found."
                });
        }


        const now =
            Date.now();


        /* =====================================================
           APPROVE
        ===================================================== */

        if (
            action ===
            "approve"
        ) {

            await requestRef
                .update({

                    verification_status:
                        "approved",

                    reviewed_at:
                        now,

                    reviewed_by:
                        "verification_admin",

                    rejection_reason:
                        ""

                });


            await usersDB
                .ref(
                    `Users/${uid}`
                )
                .update({

                    verified:
                        true,

                    verification_status:
                        "approved",

                    verification_verified_at:
                        now

                });


            return res
                .status(200)
                .json({

                    success:true,

                    status:
                        "approved"

                });
        }


        /* =====================================================
           REJECT
        ===================================================== */

        await requestRef
            .update({

                verification_status:
                    "rejected",

                rejection_reason:
                    reason,

                reviewed_at:
                    now,

                reviewed_by:
                    "verification_admin"

            });


        await usersDB
            .ref(
                `Users/${uid}`
            )
            .update({

                verification_status:
                    "rejected",

                verification_rejected_at:
                    now

            });


        return res
            .status(200)
            .json({

                success:true,

                status:
                    "rejected"

            });

    } catch (error) {

        console.error(
            "Verification review:",
            error
        );


        return res
            .status(500)
            .json({
                success:false,
                error:
                    "Unable to update verification request."
            });
    }
}

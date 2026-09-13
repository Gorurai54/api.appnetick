const {
    dataDB,
    usersDB
} = require("../../../lib/firebase");

const {
    requireAdmin
} = require("../../../lib/adminAuth");

const cors = require("../../../lib/cors");

const crypto = require("crypto");


// =====================================================
// 18 DIGIT PRIVATE VERIFICATION KEY
// =====================================================

function generatePrivateKey() {

    let result = "";

    while (result.length < 18) {

        const bytes =
            crypto.randomBytes(32);

        for (const byte of bytes) {

            // Avoid modulo bias
            if (byte >= 250) {
                continue;
            }

            result += String(byte % 10);

            if (result.length === 18) {
                break;
            }
        }
    }

    return result;
}


// =====================================================
// SEND CUSTOM EMAIL
// =====================================================

async function sendCustomEmail({
    email,
    subject,
    title,
    message,
    details,
    footer_message
}) {

    const baseUrl =
        process.env.APP_BASE_URL ||
        process.env.VERCEL_URL
            ? `https://${process.env.VERCEL_URL}`
            : "";


    const endpoint =
        process.env.APP_BASE_URL
            ? `${process.env.APP_BASE_URL}/api/send-otp`
            : `${baseUrl}/api/send-otp`;


    const secret =
        process.env.EMAIL_ADMIN_SECRET;


    if (!secret) {

        throw new Error(
            "EMAIL_ADMIN_SECRET is not configured."
        );
    }


    if (!endpoint) {

        throw new Error(
            "Email API URL is not configured."
        );
    }


    const response =
        await fetch(endpoint, {

            method: "POST",

            headers: {
                "Content-Type":
                    "application/json",

                "x-email-admin-secret":
                    secret
            },

            body:
                JSON.stringify({

                    type:
                        "custom",

                    email:
                        email,

                    subject:
                        subject,

                    title:
                        title,

                    message:
                        message,

                    details:
                        details,

                    footer_message:
                        footer_message
                })
        });


    const result =
        await response.json()
            .catch(() => ({}));


    if (!response.ok) {

        console.error(
            "Custom email error:",
            result
        );

        throw new Error(
            result.error ||
            "Unable to send email."
        );
    }


    return result;
}


// =====================================================
// HASH PRIVATE KEY
// =====================================================

function hashPrivateKey(key) {

    return crypto
        .createHash("sha256")
        .update(key)
        .digest("hex");
}


// =====================================================
// HANDLER
// =====================================================

module.exports = async function handler(req, res) {


    // =====================================================
    // CORS
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

                error:
                    "Method not allowed"
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

                    error:
                        "UID is required."
                });
        }


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

                    error:
                        "Invalid UID."
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

                    error:
                        "Invalid action."
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
                requestData.verification_status ||
                ""
            )
            .toLowerCase()
            .trim();


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


        const userData =
            userSnapshot.val() || {};


        const now =
            Date.now();


        // =================================================
        // APPLICANT EMAIL
        // =================================================

        const applicantEmail =
            String(
                requestData.email ||
                userData.email ||
                ""
            )
            .trim();


        // =================================================
        // APPROVE
        // =================================================

        if (action === "approve") {


            // -------------------------------------------------
            // EMAIL REQUIRED
            // -------------------------------------------------

            if (!applicantEmail) {

                return res
                    .status(400)
                    .json({

                        success: false,

                        error:
                            "Applicant email address is missing."
                    });
            }


            // -------------------------------------------------
            // GENERATE 18 DIGIT PRIVATE KEY
            // -------------------------------------------------

            const privateKey =
                generatePrivateKey();


            const privateKeyHash =
                hashPrivateKey(
                    privateKey
                );


            // -------------------------------------------------
            // STORE PRIVATE KEY INFORMATION
            //
            // RAW KEY IS NEVER STORED.
            // Only SHA-256 hash is stored.
            // -------------------------------------------------

            const privateKeyData = {

                key_hash:
                    privateKeyHash,

                uid:
                    uid,

                request_uid:
                    uid,

                created_at:
                    now,

                redeemed:
                    false,

                active:
                    true
            };


            // -------------------------------------------------
            // UPDATE VERIFICATION REQUEST
            // -------------------------------------------------

            await requestRef.update({

                verification_status:
                    "approved",

                reviewed_at:
                    now,

                reviewed_by:
                    "verification_admin",

                rejection_reason:
                    "",

                verification_key_status:
                    "issued",

                verification_key_created_at:
                    now,

                verification_key_redeemed:
                    false,

                verification_key_active:
                    true,

                verification_key_hash:
                    privateKeyHash

            });


            // -------------------------------------------------
            // IMPORTANT
            //
            // DO NOT SET:
            //
            // verified: true
            // verify: true
            //
            // The Appnetick app will activate the badge
            // only after the user enters the private key.
            // -------------------------------------------------


            await userRef.update({

                verification_status:
                    "approved",

                verification_approved_at:
                    now

            });


            // -------------------------------------------------
            // SAVE PRIVATE KEY RECORD
            // -------------------------------------------------

            const keyRef =
                dataDB.ref(
                    `VerificationPrivateKeys/${uid}`
                );


            await keyRef.set(
                privateKeyData
            );


            // -------------------------------------------------
            // APPROVAL EMAIL
            // -------------------------------------------------

            try {

                await sendCustomEmail({

                    email:
                        applicantEmail,

                    subject:
                        "Your Appnetick Verification Has Been Approved",

                    title:
                        "Verification Approved",

                    message:
                        "Congratulations! Your Appnetick verification application has been approved. Your private verification key is provided below. Keep this key secure and do not share it with anyone. You must enter this key inside the Appnetick app using the verification activation option to receive your verified badge.",

                    details:
                        `Private Verification Key: ${privateKey}`,

                    footer_message:
                        "This private key is linked to your Appnetick account and is intended only for the applicant. If you did not request verification, please contact Appnetick support."
                });


            } catch (emailError) {

                console.error(
                    "Approval email failed:",
                    emailError
                );


                // -------------------------------------------------
                // IMPORTANT
                //
                // Application remains approved, but mark
                // email delivery as failed so admin/backend
                // can retry later.
                // -------------------------------------------------

                await requestRef.update({

                    verification_email_status:
                        "failed",

                    verification_email_error:
                        String(
                            emailError.message ||
                            "Email failed"
                        )

                });


                return res
                    .status(500)
                    .json({

                        success: false,

                        status:
                            "approved",

                        key_generated:
                            true,

                        email_sent:
                            false,

                        error:
                            "Verification was approved, but the private key email could not be sent. Please retry the email from the admin system."
                    });
            }


            // -------------------------------------------------
            // EMAIL SUCCESS
            // -------------------------------------------------

            await requestRef.update({

                verification_email_status:
                    "sent",

                verification_email_sent_at:
                    Date.now()

            });


            return res
                .status(200)
                .json({

                    success: true,

                    status:
                        "approved",

                    key_generated:
                        true,

                    email_sent:
                        true,

                    message:
                        "Verification approved successfully. The 18-digit private verification key has been sent to the applicant's email."
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
                "verification_admin",

            verification_email_status:
                "pending"

        });


        // -------------------------------------------------
        // DO NOT GIVE VERIFIED BADGE
        // -------------------------------------------------

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


        // -------------------------------------------------
        // REJECTION EMAIL
        // -------------------------------------------------

        if (applicantEmail) {

            try {

                await sendCustomEmail({

                    email:
                        applicantEmail,

                    subject:
                        "Update About Your Appnetick Verification Application",

                    title:
                        "Verification Application Update",

                    message:
                        "We have reviewed your Appnetick verification application. Unfortunately, your application was not approved at this time. Please review the reason provided below and you may submit a new application if you become eligible.",

                    details:
                        `Reason: ${reason}`,

                    footer_message:
                        "Thank you for your interest in Appnetick."
                });


                await requestRef.update({

                    verification_email_status:
                        "sent",

                    verification_email_sent_at:
                        Date.now()

                });


            } catch (emailError) {

                console.error(
                    "Rejection email failed:",
                    emailError
                );


                await requestRef.update({

                    verification_email_status:
                        "failed",

                    verification_email_error:
                        String(
                            emailError.message ||
                            "Email failed"
                        )

                });
            }
        }


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

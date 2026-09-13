const {
    usersDB,
    dataDB
} = require("../lib/firebase");

const cors =
    require("../lib/cors");

const crypto =
    require("crypto");


/*
============================================================
HELPERS
============================================================
*/

function normalizeUsername(value) {

    return String(value || "")
        .trim()
        .replace(/^@+/, "")
        .toLowerCase();

}


function safeString(value) {

    return String(value || "").trim();

}


function getRequestBody(req) {

    if (!req.body) {
        return {};
    }

    if (typeof req.body === "string") {

        try {

            return JSON.parse(req.body);

        } catch (error) {

            return {};

        }

    }

    return req.body || {};

}


/*
============================================================
12 DIGIT STATUS CODE
============================================================
*/

function generateStatusCode() {

    let result = "";

    while (result.length < 12) {

        const byte =
            crypto.randomBytes(1)[0];

        /*
         * Avoid modulo bias.
         */

        if (byte >= 250) {
            continue;
        }

        result += String(
            byte % 10
        );

    }

    return result;

}


/*
============================================================
HASH
============================================================
*/

function hashValue(value) {

    return crypto
        .createHash("sha256")
        .update(String(value))
        .digest("hex");

}


/*
============================================================
REQUEST ID
============================================================
*/

function generateRequestId() {

    return (
        "REQ_" +
        crypto
            .randomBytes(12)
            .toString("hex")
            .toUpperCase()
    );

}


/*
============================================================
FIND USER
============================================================
*/

async function findUser(username) {

    username =
        normalizeUsername(username);


    /*
    --------------------------------------------------------
    1. UsernameIndex
    --------------------------------------------------------
    */

    const indexSnapshot =
        await usersDB
            .ref(
                `UsernameIndex/${username}`
            )
            .once("value");


    let uid = null;


    if (
        indexSnapshot.exists()
    ) {

        uid =
            safeString(
                indexSnapshot.val()
            );

    }


    /*
    --------------------------------------------------------
    2. Direct Users/{uid}
    --------------------------------------------------------
    */

    if (uid) {

        const userSnapshot =
            await usersDB
                .ref(
                    `Users/${uid}`
                )
                .once("value");


        if (
            userSnapshot.exists()
        ) {

            const value =
                userSnapshot.val() || {};


            return {

                uid:
                    value.uid ||
                    uid,

                username:
                    value.Username ||
                    value.username ||
                    username,

                full_name:
                    value.full_name ||
                    "",

                email:
                    value.email ||
                    "",

                avatar:
                    value.avatar ||
                    "",

                verified:
                    value.verified === true ||
                    value.verify === true

            };

        }

    }


    /*
    --------------------------------------------------------
    3. Exact Firebase search
    --------------------------------------------------------
    */

    const snapshot =
        await usersDB
            .ref("Users")
            .orderByChild("Username")
            .equalTo(username)
            .limitToFirst(1)
            .once("value");


    let user = null;


    snapshot.forEach(
        child => {

            if (user) {
                return;
            }


            const value =
                child.val() || {};


            user = {

                uid:
                    value.uid ||
                    child.key,

                username:
                    value.Username ||
                    value.username ||
                    username,

                full_name:
                    value.full_name ||
                    "",

                email:
                    value.email ||
                    "",

                avatar:
                    value.avatar ||
                    "",

                verified:
                    value.verified === true ||
                    value.verify === true

            };

        }
    );


    if (user) {
        return user;
    }


    /*
    --------------------------------------------------------
    4. Case-insensitive fallback
    --------------------------------------------------------
    */

    const allSnapshot =
        await usersDB
            .ref("Users")
            .once("value");


    allSnapshot.forEach(
        child => {

            if (user) {
                return;
            }


            const value =
                child.val() || {};


            const storedUsername =
                normalizeUsername(
                    value.Username ||
                    value.username ||
                    ""
                );


            if (
                storedUsername ===
                username
            ) {

                user = {

                    uid:
                        value.uid ||
                        child.key,

                    username:
                        value.Username ||
                        value.username ||
                        username,

                    full_name:
                        value.full_name ||
                        "",

                    email:
                        value.email ||
                        "",

                    avatar:
                        value.avatar ||
                        "",

                    verified:
                        value.verified === true ||
                        value.verify === true

                };

            }

        }
    );


    return user;

}


/*
============================================================
SAFE VERIFICATION DATA
============================================================

Never expose:

- private verification key
- verification_key_hash
- status code hash
- internal key record
============================================================
*/

function safeVerificationData(value) {

    if (!value) {
        return null;
    }


    return {

        verification_status:
            value.verification_status ||
            "pending",

        submitted_at:
            Number(
                value.submitted_at ||
                0
            ),

        reviewed_at:
            Number(
                value.reviewed_at ||
                0
            ),

        rejection_reason:
            value.rejection_reason ||
            "",

        verification_key_status:
            value.verification_key_status ||
            "",

        verification_key_redeemed:
            value.verification_key_redeemed === true,

        verification_key_active:
            value.verification_key_active === true

    };

}


/*
============================================================
SEND CUSTOM EMAIL
============================================================
*/

async function sendCustomEmail({
    email,
    subject,
    title,
    message,
    details,
    footer_message
}) {

    const appBaseUrl =
        safeString(
            process.env.APP_BASE_URL
        )
        .replace(/\/+$/, "");


    let endpoint = "";


    if (appBaseUrl) {

        endpoint =
            `${appBaseUrl}/api/send-otp`;

    } else if (
        process.env.VERCEL_URL
    ) {

        endpoint =
            `https://${process.env.VERCEL_URL}/api/send-otp`;

    }


    const secret =
        safeString(
            process.env.EMAIL_ADMIN_SECRET
        );


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
        await fetch(
            endpoint,
            {

                method: "POST",

                headers: {

                    "Content-Type":
                        "application/json",

                    "Accept":
                        "application/json"

                },

                body:
                    JSON.stringify({

                        type:
                            "custom",

                        /*
                         * send-otp.js custom branch
                         * checks this value.
                         */

                        admin_secret:
                            secret,

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

            }
        );


    const result =
        await response
            .json()
            .catch(
                () => ({})
            );


    if (!response.ok) {

        console.error(
            "Verification email error:",
            result
        );

        throw new Error(
            result.error ||
            "Unable to send email."
        );

    }


    return result;

}


/*
============================================================
MAIN HANDLER
============================================================
*/

module.exports =
    async function handler(
        req,
        res
    ) {


    /*
    ========================================================
    CORS
    ========================================================
    */

    if (
        cors(req, res)
    ) {

        return;

    }


    /*
    ========================================================
    ACTION
    ========================================================
    */

    const action =
        typeof req.query.action === "string"
            ? req.query.action
                .trim()
                .toLowerCase()
            : "";


    /*
    ========================================================
    CHECK USERNAME
    ========================================================
    */

    if (
        action === "check-username"
    ) {

        if (
            req.method !== "GET"
        ) {

            return res
                .status(405)
                .json({

                    success:false,

                    error:
                        "Method not allowed."

                });

        }


        try {

            let username =
                req.query.username;


            if (
                typeof username !== "string"
            ) {

                return res
                    .status(400)
                    .json({

                        success:false,

                        error:
                            "Username is required."

                    });

            }


            username =
                normalizeUsername(
                    username
                );


            if (
                !username ||
                username.length < 3 ||
                username.length > 50
            ) {

                return res
                    .status(400)
                    .json({

                        success:false,

                        code:
                            "INVALID_USERNAME",

                        error:
                            "Invalid username."

                    });

            }


            const user =
                await findUser(
                    username
                );


            if (!user) {

                return res
                    .status(200)
                    .json({

                        success:true,

                        exists:false

                    });

            }


            const verificationSnapshot =
                await dataDB
                    .ref(
                        `VerificationRequests/${user.uid}`
                    )
                    .once("value");


            let verification =
                null;


            if (
                verificationSnapshot.exists()
            ) {

                verification =
                    safeVerificationData(
                        verificationSnapshot.val()
                    );

            }


            return res
                .status(200)
                .json({

                    success:true,

                    exists:true,

                    user:user,

                    verification:
                        verification

                });


        } catch(error) {

            console.error(
                "verification check-username:",
                error
            );


            return res
                .status(500)
                .json({

                    success:false,

                    error:
                        "Unable to check username."

                });

        }

    }


    /*
    ========================================================
    STATUS
    ========================================================

    GET:

    /api/verification?action=status&status_code=123456789012

    ========================================================
    */

    if (
        action === "status" &&
        req.method === "GET"
    ) {

        try {

            const statusCode =
                String(
                    req.query.status_code ||
                    ""
                )
                .replace(/\D/g, "")
                .slice(0, 12);


            if (
                statusCode.length !== 12
            ) {

                return res
                    .status(400)
                    .json({

                        success:false,

                        error:
                            "A valid 12-digit status code is required."

                    });

            }


            const statusHash =
                hashValue(
                    statusCode
                );


            const codeSnapshot =
                await dataDB
                    .ref(
                        `VerificationStatusCodes/${statusHash}`
                    )
                    .once("value");


            if (
                !codeSnapshot.exists()
            ) {

                return res
                    .status(404)
                    .json({

                        success:false,

                        exists:false,

                        error:
                            "Invalid or unknown verification status code."

                    });

            }


            const codeData =
                codeSnapshot.val() || {};


            const uid =
                safeString(
                    codeData.uid
                );


            const requestId =
                safeString(
                    codeData.request_id
                );


            if (
                !uid ||
                !requestId
            ) {

                return res
                    .status(500)
                    .json({

                        success:false,

                        error:
                            "Verification status record is invalid."

                    });

            }


            const verificationSnapshot =
                await dataDB
                    .ref(
                        `VerificationRequests/${uid}`
                    )
                    .once("value");


            if (
                !verificationSnapshot.exists()
            ) {

                return res
                    .status(404)
                    .json({

                        success:false,

                        exists:false,

                        error:
                            "Verification application not found."

                    });

            }


            const verificationData =
                verificationSnapshot.val() || {};


            if (
                String(
                    verificationData.request_id ||
                    ""
                ) !== requestId
            ) {

                return res
                    .status(409)
                    .json({

                        success:false,

                        error:
                            "Verification status record does not match the application."

                    });

            }


            const userSnapshot =
                await usersDB
                    .ref(
                        `Users/${uid}`
                    )
                    .once("value");


            if (
                !userSnapshot.exists()
            ) {

                return res
                    .status(404)
                    .json({

                        success:false,

                        exists:false,

                        error:
                            "Appnetick account not found."

                    });

            }


            const userData =
                userSnapshot.val() || {};


            const safeUser = {

                uid:
                    uid,

                username:
                    userData.Username ||
                    userData.username ||
                    verificationData.username ||
                    "",

                full_name:
                    userData.full_name ||
                    verificationData.full_name ||
                    "",

                avatar:
                    userData.avatar ||
                    "",

                verified:
                    userData.verified === true ||
                    userData.verify === true

            };


            return res
                .status(200)
                .json({

                    success:true,

                    exists:true,

                    user:
                        safeUser,

                    verification:
                        safeVerificationData(
                            verificationData
                        )

                });


        } catch(error) {

            console.error(
                "verification status:",
                error
            );


            return res
                .status(500)
                .json({

                    success:false,

                    error:
                        "Unable to fetch verification status."

                });

        }

    }


    /*
    ========================================================
    ACTIVATE VERIFICATION KEY
    ========================================================

    POST:

    /api/verification?action=activate

    Body:

    {
        status_code:"123456789012",
        verification_key:"123456789012345678"
    }

    ========================================================
    */

    if (
        action === "activate" &&
        req.method === "POST"
    ) {

        try {

            const body =
                getRequestBody(req);


            /*
            ------------------------------------------------
            STATUS CODE
            ------------------------------------------------
            */

            const statusCode =
                String(
                    body.status_code ||
                    ""
                )
                .replace(/\D/g, "")
                .slice(0, 12);


            /*
            ------------------------------------------------
            PRIVATE KEY
            ------------------------------------------------
            */

            const privateKey =
                String(
                    body.verification_key ||
                    ""
                )
                .replace(/\D/g, "")
                .slice(0, 18);


            if (
                statusCode.length !== 12
            ) {

                return res
                    .status(400)
                    .json({

                        success:false,

                        error:
                            "A valid 12-digit status code is required."

                    });

            }


            if (
                privateKey.length !== 18
            ) {

                return res
                    .status(400)
                    .json({

                        success:false,

                        error:
                            "A valid 18-digit private verification key is required."

                    });

            }


            /*
            ------------------------------------------------
            FIND STATUS CODE
            ------------------------------------------------
            */

            const statusHash =
                hashValue(
                    statusCode
                );


            const codeSnapshot =
                await dataDB
                    .ref(
                        `VerificationStatusCodes/${statusHash}`
                    )
                    .once("value");


            if (
                !codeSnapshot.exists()
            ) {

                return res
                    .status(404)
                    .json({

                        success:false,

                        error:
                            "Invalid verification status code."

                    });

            }


            const codeData =
                codeSnapshot.val() || {};


            const uid =
                safeString(
                    codeData.uid
                );


            const requestId =
                safeString(
                    codeData.request_id
                );


            if (
                !uid ||
                !requestId
            ) {

                return res
                    .status(500)
                    .json({

                        success:false,

                        error:
                            "Verification record is invalid."

                    });

            }


            /*
            ------------------------------------------------
            LOAD REQUEST
            ------------------------------------------------
            */

            const requestRef =
                dataDB.ref(
                    `VerificationRequests/${uid}`
                );


            const requestSnapshot =
                await requestRef.once("value");


            if (
                !requestSnapshot.exists()
            ) {

                return res
                    .status(404)
                    .json({

                        success:false,

                        error:
                            "Verification application not found."

                    });

            }


            const requestData =
                requestSnapshot.val() || {};


            /*
            ------------------------------------------------
            REQUEST MATCH
            ------------------------------------------------
            */

            if (
                String(
                    requestData.request_id ||
                    ""
                ) !== requestId
            ) {

                return res
                    .status(409)
                    .json({

                        success:false,

                        error:
                            "Verification request mismatch."

                    });

            }


            /*
            ------------------------------------------------
            APPROVED CHECK
            ------------------------------------------------
            */

            const currentStatus =
                String(
                    requestData.verification_status ||
                    ""
                )
                .trim()
                .toLowerCase();


            if (
                currentStatus !== "approved"
            ) {

                return res
                    .status(409)
                    .json({

                        success:false,

                        code:
                            "NOT_APPROVED",

                        error:
                            "Your verification application has not been approved yet."

                    });

            }


            /*
            ------------------------------------------------
            KEY USED CHECK
            ------------------------------------------------
            */

            if (
                requestData.verification_key_redeemed ===
                true
            ) {

                return res
                    .status(409)
                    .json({

                        success:false,

                        code:
                            "KEY_ALREADY_USED",

                        error:
                            "This private verification key has already been used."

                    });

            }


            /*
            ------------------------------------------------
            KEY ACTIVE CHECK
            ------------------------------------------------
            */

            if (
                requestData.verification_key_active !==
                true
            ) {

                return res
                    .status(409)
                    .json({

                        success:false,

                        error:
                            "This private verification key is no longer active."

                    });

            }


            /*
            ------------------------------------------------
            HASH ENTERED KEY
            ------------------------------------------------
            */

            const enteredHash =
                hashValue(
                    privateKey
                );


            const storedHash =
                safeString(
                    requestData.verification_key_hash
                );


            let keyMatches = false;


            if (
                storedHash.length === 64 &&
                enteredHash.length === 64
            ) {

                try {

                    keyMatches =
                        crypto.timingSafeEqual(

                            Buffer.from(
                                enteredHash,
                                "hex"
                            ),

                            Buffer.from(
                                storedHash,
                                "hex"
                            )

                        );

                } catch(error) {

                    keyMatches =
                        false;

                }

            }


            if (
                !keyMatches
            ) {

                return res
                    .status(401)
                    .json({

                        success:false,

                        code:
                            "INVALID_PRIVATE_KEY",

                        error:
                            "The private verification key is incorrect."

                    });

            }


            /*
            ------------------------------------------------
            USER
            ------------------------------------------------
            */

            const userRef =
                usersDB.ref(
                    `Users/${uid}`
                );


            const userSnapshot =
                await userRef.once("value");


            if (
                !userSnapshot.exists()
            ) {

                return res
                    .status(404)
                    .json({

                        success:false,

                        error:
                            "Appnetick account not found."

                    });

            }


            const now =
                Date.now();


            /*
            =================================================
            ACTIVATE USER BADGE
            =================================================
            */

            await userRef.update({

                verified:
                    true,

                verify:
                    true,

                verification_status:
                    "verified",

                verification_verified_at:
                    now

            });


            /*
            =================================================
            MARK KEY REDEEMED
            =================================================
            */

            await requestRef.update({

                verification_key_redeemed:
                    true,

                verification_key_redeemed_at:
                    now,

                verification_key_active:
                    false,

                verification_key_status:
                    "redeemed",

                verification_activated_at:
                    now

            });


            /*
            =================================================
            DISABLE STATUS CODE FOR ACTIVATION
            =================================================
            */

            await dataDB
                .ref(
                    `VerificationStatusCodes/${statusHash}`
                )
                .update({

                    active:
                        false,

                    used:
                        true,

                    used_at:
                        now

                });


            /*
            =================================================
            SUCCESS
            =================================================
            */

            return res
                .status(200)
                .json({

                    success:true,

                    verified:true,

                    status:
                        "verified",

                    message:
                        "Your Appnetick verification has been activated successfully."

                });


        } catch(error) {

            console.error(
                "verification activation:",
                error
            );


            return res
                .status(500)
                .json({

                    success:false,

                    error:
                        "Unable to activate verification."

                });

        }

    }


    /*
    ========================================================
    SUBMIT APPLICATION
    ========================================================
    */

    if (
        action === "submit" &&
        req.method === "POST"
    ) {

        try {

            const body =
                getRequestBody(req);


            /*
            ------------------------------------------------
            USERNAME
            ------------------------------------------------
            */

            const username =
                normalizeUsername(
                    body.username
                );


            if (!username) {

                return res
                    .status(400)
                    .json({

                        success:false,

                        code:
                            "INVALID_USERNAME",

                        error:
                            "Username is required."

                    });

            }


            if (
                username.length < 3 ||
                username.length > 50
            ) {

                return res
                    .status(400)
                    .json({

                        success:false,

                        code:
                            "INVALID_USERNAME",

                        error:
                            "Invalid username."

                    });

            }


            /*
            ------------------------------------------------
            FIND REAL USER
            ------------------------------------------------
            */

            const actualUser =
                await findUser(
                    username
                );


            if (!actualUser) {

                return res
                    .status(404)
                    .json({

                        success:false,

                        code:
                            "USERNAME_NOT_FOUND",

                        error:
                            "No Appnetick account was found with this username."

                    });

            }


            /*
            ------------------------------------------------
            ALREADY VERIFIED
            ------------------------------------------------
            */

            if (
                actualUser.verified
            ) {

                return res
                    .status(409)
                    .json({

                        success:false,

                        code:
                            "ALREADY_APPROVED",

                        error:
                            "This Appnetick account is already verified."

                    });

            }


            /*
            ------------------------------------------------
            EXISTING REQUEST
            ------------------------------------------------
            */

            const requestRef =
                dataDB.ref(
                    `VerificationRequests/${actualUser.uid}`
                );


            const existingSnapshot =
                await requestRef.once("value");


            if (
                existingSnapshot.exists()
            ) {

                const existing =
                    existingSnapshot.val() || {};


                const existingStatus =
                    String(
                        existing.verification_status ||
                        ""
                    )
                    .trim()
                    .toLowerCase();


                if (
                    existingStatus === "pending"
                ) {

                    return res
                        .status(409)
                        .json({

                            success:false,

                            code:
                                "ALREADY_PENDING",

                            error:
                                "A verification application is already under review."

                        });

                }


                if (
                    existingStatus === "approved"
                ) {

                    return res
                        .status(409)
                        .json({

                            success:false,

                            code:
                                "ALREADY_APPROVED",

                            error:
                                "This account already has an approved verification application."

                        });

                }

            }


            /*
            =================================================
            REQUIRED CONFIRMATIONS
            =================================================
            */

            if (
                body.authenticity_confirmed !== true ||
                body.information_confirmed !== true ||
                body.terms_confirmed !== true
            ) {

                return res
                    .status(400)
                    .json({

                        success:false,

                        error:
                            "All confirmations are required."

                    });

            }


            /*
            =================================================
            ACCOUNT EMAIL
            =================================================

            The email from Users is authoritative.

            =================================================
            */

            const applicantEmail =
                safeString(
                    actualUser.email
                )
                .toLowerCase();


            if (
                !applicantEmail ||
                !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
                    applicantEmail
                )
            ) {

                return res
                    .status(400)
                    .json({

                        success:false,

                        code:
                            "ACCOUNT_EMAIL_MISSING",

                        error:
                            "The Appnetick account does not have a valid email address."

                    });

            }


            /*
            =================================================
            GENERATE STATUS CODE
            =================================================
            */

            const statusCode =
                generateStatusCode();


            const statusHash =
                hashValue(
                    statusCode
                );


            const requestId =
                generateRequestId();


            const submittedAt =
                Date.now();


            /*
            =================================================
            VERIFICATION REQUEST
            =================================================
            */

            const verificationData = {

                uid:
                    actualUser.uid,

                request_id:
                    requestId,

                username:
                    actualUser.username,

                full_name:
                    actualUser.full_name,

                legal_name:
                    safeString(
                        body.legal_name
                    ),

                email:
                    applicantEmail,

                date_of_birth:
                    safeString(
                        body.date_of_birth
                    ),

                country:
                    safeString(
                        body.country
                    ),

                phone:
                    safeString(
                        body.phone
                    ),

                account_category:
                    safeString(
                        body.account_category
                    ),

                profession:
                    safeString(
                        body.profession
                    ),

                verification_reason:
                    safeString(
                        body.verification_reason
                    ),

                known_for:
                    safeString(
                        body.known_for
                    ),

                website:
                    safeString(
                        body.website
                    ),

                social_profile:
                    safeString(
                        body.social_profile
                    ),

                audience:
                    safeString(
                        body.audience
                    ),

                content_category:
                    safeString(
                        body.content_category
                    ),

                achievement:
                    safeString(
                        body.achievement
                    ),

                public_presence:
                    safeString(
                        body.public_presence
                    ),

                authenticity_confirmed:
                    true,

                information_confirmed:
                    true,

                terms_confirmed:
                    true,

                verification_status:
                    "pending",

                submitted_at:
                    submittedAt,

                reviewed_at:
                    0,

                reviewed_by:
                    "",

                rejection_reason:
                    "",

                /*
                 * Private verification key fields.
                 * These will be filled only after admin approval.
                 */

                verification_key_status:
                    "",

                verification_key_created_at:
                    0,

                verification_key_redeemed:
                    false,

                verification_key_redeemed_at:
                    0,

                verification_key_active:
                    false,

                verification_key_hash:
                    "",

                verification_activated_at:
                    0,

                verification_email_status:
                    "pending",

                verification_email_sent_at:
                    0,

                verification_email_error:
                    ""

            };


            /*
            =================================================
            SAVE REQUEST
            =================================================
            */

            await requestRef.set(
                verificationData
            );


            /*
            =================================================
            SAVE STATUS CODE MAPPING
            =================================================

            Raw code is NEVER stored.

            =================================================
            */

            await dataDB
                .ref(
                    `VerificationStatusCodes/${statusHash}`
                )
                .set({

                    uid:
                        actualUser.uid,

                    request_id:
                        requestId,

                    created_at:
                        submittedAt,

                    active:
                        true,

                    used:
                        false

                });


            /*
            =================================================
            SEND STATUS EMAIL
            =================================================
            */

            try {

                await sendCustomEmail({

                    email:
                        applicantEmail,

                    subject:
                        "Your Appnetick Verification Status Code",

                    title:
                        "Verification Application Submitted",

                    message:
                        "Your Appnetick verification application has been submitted successfully. Your application is now pending review. Use the private 12-digit status code below to check the status of your application.",

                    details:
                        `Verification Status Code: ${statusCode}`,

                    footer_message:
                        "Keep this status code secure. If your application is approved, Appnetick will send a separate email containing your 18-digit private verification key."

                });


                await requestRef.update({

                    verification_email_status:
                        "sent",

                    verification_email_sent_at:
                        Date.now(),

                    verification_email_error:
                        ""

                });


            } catch(emailError) {

                console.error(
                    "Verification status email failed:",
                    emailError
                );


                await requestRef.update({

                    verification_email_status:
                        "failed",

                    verification_email_error:
                        safeString(
                            emailError.message
                        )

                });


                /*
                ------------------------------------------------
                Application remains saved.
                ------------------------------------------------

                Return code once because email failed.
                */

                return res
                    .status(200)
                    .json({

                        success:true,

                        username:
                            actualUser.username,

                        verification_status:
                            "pending",

                        email_sent:
                            false,

                        status_code:
                            statusCode,

                        message:
                            "Application submitted, but the status code email could not be sent. Please save your status code."

                    });

            }


            /*
            =================================================
            SUCCESS
            =================================================
            */

            return res
                .status(200)
                .json({

                    success:true,

                    username:
                        actualUser.username,

                    verification_status:
                        "pending",

                    email_sent:
                        true,

                    message:
                        "Verification application submitted successfully. Your 12-digit status code has been sent to your email."

                });


        } catch(error) {

            /*
            ------------------------------------------------
            SERVER LOG
            ------------------------------------------------
            */

            console.error(
                "verification submit ERROR:",
                error
            );


            /*
            ------------------------------------------------
            Do NOT expose Firebase internals to client.
            ------------------------------------------------
            */

            return res
                .status(500)
                .json({

                    success:false,

                    code:
                        "SUBMIT_FAILED",

                    error:
                        "Unable to submit verification application."

                });

        }

    }


    /*
    ========================================================
    METHOD NOT ALLOWED
    ========================================================
    */

    if (
        action === "status" ||
        action === "activate" ||
        action === "submit"
    ) {

        return res
            .status(405)
            .json({

                success:false,

                error:
                    "Method not allowed."

            });

    }


    /*
    ========================================================
    UNKNOWN ACTION
    ========================================================
    */

    return res
        .status(400)
        .json({

            success:false,

            error:
                "Invalid verification action."

        });

};

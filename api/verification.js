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


/*
============================================================
GENERATE 12 DIGIT STATUS CODE
============================================================
*/

function generateStatusCode() {

    let result = "";

    while (result.length < 12) {

        const bytes =
            crypto.randomBytes(32);

        for (const byte of bytes) {

            if (byte >= 250) {
                continue;
            }

            result += String(byte % 10);

            if (result.length === 12) {
                break;
            }

        }

    }

    return result;

}


/*
============================================================
HASH STATUS CODE / PRIVATE KEY
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
GENERATE REQUEST ID
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

Priority:

1. UsernameIndex/{username}
2. Users/{uid}
3. Firebase exact search
4. Case-insensitive fallback

============================================================
*/


async function findUser(username) {

    /*
    --------------------------------------------------------
    UsernameIndex
    --------------------------------------------------------
    */

    const indexSnapshot =
        await usersDB
            .ref(
                "UsernameIndex/" +
                username
            )
            .once("value");


    let uid = null;


    if (
        indexSnapshot.exists()
    ) {

        uid =
            String(
                indexSnapshot.val()
            ).trim();

    }


    /*
    --------------------------------------------------------
    Load user directly
    --------------------------------------------------------
    */

    if (uid) {

        const userSnapshot =
            await usersDB
                .ref(
                    "Users/" +
                    uid
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
    Firebase indexed search
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
    Case-insensitive fallback
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

NEVER return:

- verification_key_hash
- status code hash
- private key
- email
- internal UID mapping
- key record

============================================================
*/


function safeVerificationData(
    value
) {

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
            value.verification_key_redeemed === true

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
        String(
            process.env.APP_BASE_URL ||
            ""
        )
        .trim()
        .replace(/\/+$/, "");


    let endpoint = "";


    if (appBaseUrl) {

        endpoint =
            `${appBaseUrl}/api/send-otp`;

    } else if (process.env.VERCEL_URL) {

        endpoint =
            `https://${process.env.VERCEL_URL}/api/send-otp`;

    }


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
        await fetch(
            endpoint,
            {

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
            "Verification custom email error:",
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
    DETERMINE ACTION
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
                !username ||
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
                username.length > 50
            ) {

                return res
                    .status(400)
                    .json({

                        success:false,

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
                        "Internal server error."

                });

        }

    }


    /*
    ========================================================
    STATUS
    ========================================================

    GET:

    /api/verification/status?status_code=123456789012

    ========================================================
    */

    if (
        action === "status" ||
        (
            action === "" &&
            req.method === "GET"
        )
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

            /*
            ------------------------------------------------
            STATUS CODE
            ------------------------------------------------
            */

            const rawStatusCode =
                typeof req.query.status_code === "string"
                    ? req.query.status_code
                    : "";


            const statusCode =
                rawStatusCode
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


            /*
            ------------------------------------------------
            HASH STATUS CODE
            ------------------------------------------------
            */

            const statusCodeHash =
                hashValue(
                    statusCode
                );


            /*
            ------------------------------------------------
            FIND STATUS CODE RECORD
            ------------------------------------------------
            */

            const codeSnapshot =
                await dataDB
                    .ref(
                        `VerificationStatusCodes/${statusCodeHash}`
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


            /*
            ------------------------------------------------
            LOAD REQUEST
            ------------------------------------------------
            */

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


            /*
            ------------------------------------------------
            REQUEST ID VALIDATION
            ------------------------------------------------
            */

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


            /*
            ------------------------------------------------
            LOAD USER
            ------------------------------------------------
            */

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


            /*
            ------------------------------------------------
            SAFE VERIFICATION
            ------------------------------------------------
            */

            const safeVerification =
                safeVerificationData(
                    verificationData
                );


            /*
            ------------------------------------------------
            RESPONSE
            ------------------------------------------------
            */

            return res
                .status(200)
                .json({

                    success:true,

                    exists:true,

                    user:
                        safeUser,

                    verification:
                        safeVerification

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
    ACTIVATE VERIFICATION
    ========================================================

    POST:

    /api/verification/status

    Body:

    {
        action:"activate",
        status_code:"123456789012",
        verification_key:"123456789012345678"
    }

    ========================================================
    */

    if (
        req.method === "POST" &&
        (
            action === "status" ||
            action === ""
        )
    ) {


        try {

            const body =
                req.body || {};


            const requestedAction =
                typeof body.action === "string"
                    ? body.action
                        .trim()
                        .toLowerCase()
                    : "";


            if (
                requestedAction !==
                "activate"
            ) {

                return res
                    .status(400)
                    .json({

                        success:false,

                        error:
                            "Invalid verification action."

                    });

            }


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
            HASH STATUS CODE
            ------------------------------------------------
            */

            const statusCodeHash =
                hashValue(
                    statusCode
                );


            /*
            ------------------------------------------------
            FIND STATUS CODE
            ------------------------------------------------
            */

            const codeSnapshot =
                await dataDB
                    .ref(
                        `VerificationStatusCodes/${statusCodeHash}`
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
            REQUEST ID CHECK
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
            STATUS CHECK
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
                currentStatus !==
                "approved"
            ) {

                return res
                    .status(409)
                    .json({

                        success:false,

                        error:
                            "Your verification application has not been approved yet."

                    });

            }


            /*
            ------------------------------------------------
            ALREADY REDEEMED
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
                requestData.verification_key_active ===
                false
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

            const enteredKeyHash =
                hashValue(
                    privateKey
                );


            const storedKeyHash =
                safeString(
                    requestData.verification_key_hash
                );


            /*
            ------------------------------------------------
            CONSTANT-TIME HASH COMPARISON
            ------------------------------------------------
            */

            let keyMatches = false;


            if (
                storedKeyHash &&
                storedKeyHash.length === 64 &&
                enteredKeyHash.length === 64
            ) {

                try {

                    keyMatches =
                        crypto.timingSafeEqual(
                            Buffer.from(
                                enteredKeyHash,
                                "hex"
                            ),
                            Buffer.from(
                                storedKeyHash,
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
            LOAD USER
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
            ACTIVATE BADGE
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
            MARK KEY AS USED
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
            ------------------------------------------------
            DISABLE STATUS CODE FOR FUTURE ACTIVATION
            ------------------------------------------------
            */

            await dataDB
                .ref(
                    `VerificationStatusCodes/${statusCodeHash}`
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
    SUBMIT
    ========================================================
    */


    if (
        action === "submit"
    ) {


        if (
            req.method !== "POST"
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

            const body =
                req.body || {};


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

                        error:
                            "Username is required."

                    });

            }


            if (
                username.length > 50
            ) {

                return res
                    .status(400)
                    .json({

                        success:false,

                        error:
                            "Invalid username."

                    });

            }


            /*
            ------------------------------------------------
            FIND ACTUAL USER
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

                        error:
                            "Username not found."

                    });

            }


            /*
            ------------------------------------------------
            EXISTING REQUEST
            ------------------------------------------------
            */

            const existingSnapshot =
                await dataDB
                    .ref(
                        `VerificationRequests/${actualUser.uid}`
                    )
                    .once("value");


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
                    existingStatus ===
                    "approved"
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


                if (
                    existingStatus ===
                    "pending"
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
            EMAIL
            =================================================

            Email is taken from the real Users record.
            Frontend email is NOT trusted.

            =================================================
            */

            const applicantEmail =
                safeString(
                    actualUser.email
                );


            if (!applicantEmail) {

                return res
                    .status(400)
                    .json({

                        success:false,

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


            const statusCodeHash =
                hashValue(
                    statusCode
                );


            const requestId =
                generateRequestId();


            const submittedAt =
                Date.now();


            /*
            =================================================
            VERIFICATION DATA
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
                    "pending"

            };


            /*
            =================================================
            SAVE REQUEST
            =================================================
            */

            await dataDB
                .ref(
                    `VerificationRequests/${actualUser.uid}`
                )
                .set(
                    verificationData
                );


            /*
            =================================================
            SAVE STATUS CODE MAPPING
            =================================================

            Raw 12-digit code is NEVER stored.

            =================================================
            */

            await dataDB
                .ref(
                    `VerificationStatusCodes/${statusCodeHash}`
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
            SEND STATUS CODE EMAIL
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
                        "Your Appnetick verification application has been submitted successfully. Use the 12-digit status code below to check your application status on the Appnetick verification status page.",

                    details:
                        `Verification Status Code: ${statusCode}`,

                    footer_message:
                        "Keep this status code secure. If your application is approved, you will receive a separate email containing your 18-digit private verification key."

                });


                await dataDB
                    .ref(
                        `VerificationRequests/${actualUser.uid}`
                    )
                    .update({

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


                await dataDB
                    .ref(
                        `VerificationRequests/${actualUser.uid}`
                    )
                    .update({

                        verification_email_status:
                            "failed",

                        verification_email_error:
                            String(
                                emailError.message ||
                                "Email failed"
                            )

                    });


                /*
                ------------------------------------------------
                IMPORTANT
                ------------------------------------------------

                Application is still saved.

                Return the status code ONCE so the frontend
                can show it to the applicant if email fails.

                ------------------------------------------------
                */

                return res
                    .status(200)
                    .json({

                        success:true,

                        uid:
                            actualUser.uid,

                        username:
                            actualUser.username,

                        verification_status:
                            "pending",

                        email_sent:
                            false,

                        status_code:
                            statusCode,

                        message:
                            "Verification application submitted, but the status code email could not be sent. Please save the status code shown here."

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

                    uid:
                        actualUser.uid,

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

            console.error(
                "verification submit:",
                error
            );


            return res
                .status(500)
                .json({

                    success:false,

                    error:
                        "Unable to submit verification application."

                });

        }

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

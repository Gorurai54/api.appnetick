const {
    usersDB,
    dataDB
} = require("../lib/firebase");

const cors =
    require("../lib/cors");


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
FIND USER
============================================================

Priority:

1. UsernameIndex/{username}
2. Users/{uid}
3. Fallback scan for case-insensitive Username

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
    If index gave UID, load user directly
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

    This is only used when UsernameIndex and
    Firebase exact search don't find the user.
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

Never expose unnecessary verification information from
the status/check-username API.

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
            value.submitted_at ||
            0,

        reviewed_at:
            value.reviewed_at ||
            0,

        rejection_reason:
            value.rejection_reason ||
            ""

    };

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

    Supported:

    ?action=check-username
    ?action=status
    ?action=submit

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

            /*
            ------------------------------------------------
            Username
            ------------------------------------------------
            */

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


            if (!username) {

                return res
                    .status(400)
                    .json({

                        success:false,

                        error:
                            "Invalid username."

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
            Find user
            ------------------------------------------------
            */

            const user =
                await findUser(
                    username
                );


            /*
            ------------------------------------------------
            User not found
            ------------------------------------------------
            */

            if (!user) {

                return res
                    .status(200)
                    .json({

                        success:true,

                        exists:false

                    });

            }


            /*
            ------------------------------------------------
            Existing verification request
            ------------------------------------------------
            */

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


            /*
            ------------------------------------------------
            Response
            ------------------------------------------------
            */

            return res
                .status(200)
                .json({

                    success:true,

                    exists:true,

                    user:user,

                    verification:verification

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
    */


    if (
        action === "status"
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
            Username
            ------------------------------------------------
            */

            const rawUsername =
                typeof req.query.username === "string"
                    ? req.query.username
                    : "";


            const username =
                normalizeUsername(
                    rawUsername
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
            Find user
            ------------------------------------------------
            */

            const user =
                await findUser(
                    username
                );


            /*
            ------------------------------------------------
            User not found
            ------------------------------------------------
            */

            if (!user) {

                return res
                    .status(200)
                    .json({

                        success:true,

                        exists:false

                    });

            }


            /*
            ------------------------------------------------
            Verification request
            ------------------------------------------------
            */

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


            /*
            ------------------------------------------------
            Safe user information
            ------------------------------------------------
            */

            const safeUser = {

                uid:
                    user.uid,

                username:
                    user.username ||
                    username,

                full_name:
                    user.full_name ||
                    "",

                avatar:
                    user.avatar ||
                    ""

            };


            /*
            ------------------------------------------------
            Response
            ------------------------------------------------
            */

            return res
                .status(200)
                .json({

                    success:true,

                    exists:true,

                    user:safeUser,

                    verification:verification

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
            Username
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
            IMPORTANT
            ------------------------------------------------

            UID from client is NOT trusted.

            User is found again using username.
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
            Existing verification request
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


                /*
                --------------------------------------------
                Already approved
                --------------------------------------------
                */

                if (
                    existingStatus ===
                    "approved"
                ) {

                    return res
                        .status(409)
                        .json({

                            success:false,

                            code:
                                "ALREADY_VERIFIED",

                            error:
                                "This account is already verified."

                        });

                }


                /*
                --------------------------------------------
                Already pending
                --------------------------------------------
                */

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
            VERIFICATION DATA
            =================================================

            Only allowed fields are saved.

            Password / PIN are NEVER saved from the
            frontend and NEVER copied from Users.

            =================================================
            */

            const verificationData = {

                uid:
                    actualUser.uid,

                username:
                    actualUser.username,

                full_name:
                    actualUser.full_name,

                legal_name:
                    safeString(
                        body.legal_name
                    ),

                email:
                    actualUser.email,

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
                    body.authenticity_confirmed === true,

                information_confirmed:
                    body.information_confirmed === true,

                terms_confirmed:
                    body.terms_confirmed === true,

                verification_status:
                    "pending",

                submitted_at:
                    Date.now(),

                reviewed_at:
                    0,

                reviewed_by:
                    ""

            };


            /*
            =================================================
            REQUIRED CONFIRMATIONS
            =================================================
            */

            if (
                !verificationData
                    .authenticity_confirmed ||
                !verificationData
                    .information_confirmed ||
                !verificationData
                    .terms_confirmed
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
            SAVE
            =================================================

            DataApp
                VerificationRequests
                    UID

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
            ------------------------------------------------
            Success
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
                        "pending"

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

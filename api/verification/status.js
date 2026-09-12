const {
    usersDB,
    dataDB
} = require("../../../lib/firebase");

const cors =
    require("../../../lib/cors");


module.exports = async function handler(
    req,
    res
) {

    /*
    ========================================================
    CORS
    ========================================================
    */

    if (cors(req, res)) {
        return;
    }


    /*
    ========================================================
    METHOD
    ========================================================
    */

    if (
        req.method !== "GET"
    ) {

        return res.status(405).json({
            success:false,
            error:"Method not allowed"
        });

    }


    /*
    ========================================================
    USERNAME
    ========================================================
    */

    try {

        const rawUsername =
            typeof req.query.username === "string"
                ? req.query.username
                : "";


        const username =
            rawUsername
                .trim()
                .replace(
                    /^@+/,
                    ""
                )
                .toLowerCase();


        if (!username) {

            return res.status(400).json({
                success:false,
                error:"Username is required."
            });

        }


        /*
        ====================================================
        BASIC VALIDATION
        ====================================================
        */

        if (
            username.length > 50
        ) {

            return res.status(400).json({
                success:false,
                error:"Invalid username."
            });

        }


        /*
        ====================================================
        FIND USER
        ====================================================
        */

        let uid = null;
        let userData = null;


        /*
        ----------------------------------------------------
        First try UsernameIndex
        ----------------------------------------------------
        */

        const indexSnapshot =
            await usersDB
                .ref(
                    "UsernameIndex/" +
                    username
                )
                .once("value");


        if (
            indexSnapshot.exists()
        ) {

            uid =
                String(
                    indexSnapshot.val()
                );

        }


        /*
        ----------------------------------------------------
        Fallback:
        Users ordered by Username
        ----------------------------------------------------
        */

        if (!uid) {

            const usersSnapshot =
                await usersDB
                    .ref("Users")
                    .orderByChild("Username")
                    .equalTo(username)
                    .limitToFirst(1)
                    .once("value");


            if (
                usersSnapshot.exists()
            ) {

                const users =
                    usersSnapshot.val();


                const firstUid =
                    Object.keys(
                        users
                    )[0];


                uid =
                    firstUid;


                userData =
                    users[firstUid] || {};

            }

        }


        /*
        ====================================================
        USER NOT FOUND
        ====================================================
        */

        if (!uid) {

            return res.status(200).json({
                success:true,
                exists:false
            });

        }


        /*
        ====================================================
        LOAD USER
        ====================================================
        */

        if (!userData) {

            const userSnapshot =
                await usersDB
                    .ref(
                        "Users/" +
                        uid
                    )
                    .once("value");


            if (
                !userSnapshot.exists()
            ) {

                return res.status(200).json({
                    success:true,
                    exists:false
                });

            }


            userData =
                userSnapshot.val() || {};

        }


        /*
        ====================================================
        VERIFICATION REQUEST
        ====================================================
        */

        const verificationSnapshot =
            await dataDB
                .ref(
                    "VerificationRequests/" +
                    uid
                )
                .once("value");


        let verification = null;


        if (
            verificationSnapshot.exists()
        ) {

            const rawVerification =
                verificationSnapshot.val() || {};


            /*
            ------------------------------------------------
            ONLY RETURN SAFE STATUS INFORMATION
            ------------------------------------------------
            */

            verification = {

                verification_status:
                    rawVerification
                        .verification_status ||
                    "pending",

                submitted_at:
                    rawVerification
                        .submitted_at ||
                    0,

                reviewed_at:
                    rawVerification
                        .reviewed_at ||
                    0,

                rejection_reason:
                    rawVerification
                        .rejection_reason ||
                    ""

            };

        }


        /*
        ====================================================
        SAFE USER DATA
        ====================================================
        */

        const safeUser = {

            uid:uid,

            username:
                userData.Username ||
                userData.username ||
                username,

            full_name:
                userData.full_name ||
                userData.name ||
                "",

            avatar:
                userData.avatar ||
                ""

        };


        /*
        ====================================================
        RESPONSE
        ====================================================
        */

        return res.status(200).json({

            success:true,

            exists:true,

            user:safeUser,

            verification:verification

        });


    } catch(error) {

        console.error(
            "Verification status error:",
            error
        );


        return res.status(500).json({

            success:false,

            error:
                "Unable to fetch verification status."

        });

    }

};

const {
    usersDB,
    dataDB
} = require("../../lib/firebase");

const cors =
    require("../../lib/cors");


module.exports = async function handler(
    req,
    res
) {

    if (
        cors(req, res)
    ) {
        return;
    }


    if (
        req.method !== "GET"
    ) {

        return res
            .status(405)
            .json({
                error:
                    "Method not allowed"
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
                    error:
                        "Username is required."
                });

        }


        username =
            username
                .trim()
                .replace(/^@+/, "")
                .toLowerCase();


        if (!username) {

            return res
                .status(400)
                .json({
                    error:
                        "Invalid username."
                });

        }


        /*
         * Users/{uid} में Username field search.
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

                const value =
                    child.val() || {};


                user = {

                    uid:
                        value.uid ||
                        child.key,

                    username:
                        value.Username ||
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


        if (!user) {

            /*
             * Agar database mein Username
             * case-sensitive stored hai,
             * fallback search.
             */

            const allSnapshot =
                await usersDB
                    .ref("Users")
                    .once("value");


            allSnapshot.forEach(
                child => {

                    if (user) return;


                    const value =
                        child.val() || {};


                    const storedUsername =
                        String(
                            value.Username || ""
                        )
                        .trim()
                        .replace(/^@+/, "")
                        .toLowerCase();


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

        }


        if (!user) {

            return res
                .status(200)
                .json({
                    exists:false
                });

        }


        /*
         * Verification request उसी UID पर check होगी.
         */

        const verificationSnapshot =
            await dataDB
                .ref(
                    `VerificationRequests/${user.uid}`
                )
                .once("value");


        let verification = null;


        if (
            verificationSnapshot.exists()
        ) {

            verification =
                verificationSnapshot.val();

        }


        /*
         * IMPORTANT:
         * Password / PIN कभी return नहीं करना.
         */

        return res
            .status(200)
            .json({

                exists:true,

                user,

                verification

            });


    } catch(error) {

        console.error(
            "check-username:",
            error
        );


        return res
            .status(500)
            .json({
                error:
                    "Internal server error."
            });

    }

};

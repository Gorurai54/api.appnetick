const {
    dataDB
} = require("../../../lib/firebase");

const {
    requireAdmin
} = require("../../../lib/adminAuth");

const cors =
    require("../../../lib/cors");


module.exports = async function handler(req, res) {

    /*
     * CORS
     */

    if (cors(req, res)) {
        return;
    }


    /*
     * Only GET
     */

    if (req.method !== "GET") {

        return res.status(405).json({
            error: "Method not allowed"
        });

    }


    /*
     * ADMIN AUTH
     */

    try {

        requireAdmin(req);

    } catch (error) {

        console.error(
            "ADMIN AUTH ERROR:",
            error
        );

        return res.status(401).json({

            error:
                error.message ||
                "Unauthorized"

        });

    }


    /*
     * FIREBASE / DATAAPP
     */

    try {

        const snapshot =
            await dataDB
                .ref(
                    "VerificationRequests"
                )
                .once("value");


        const value =
            snapshot.val();


        /*
         * No verification requests
         */

        if (!value) {

            return res.status(200).json({

                requests: []

            });

        }


        /*
         * Convert Firebase object
         * into array
         */

        const requests =
            Object.keys(value)
                .map(
                    function(uid) {

                        const request =
                            value[uid];


                        if (
                            !request ||
                            typeof request !==
                            "object"
                        ) {

                            return null;

                        }


                        return {

                            ...request,

                            uid:
                                request.uid ||
                                uid

                        };

                    }
                )
                .filter(Boolean);


        /*
         * Newest requests first
         */

        requests.sort(
            function(a,b) {

                const aTime =
                    Number(
                        a.submitted_at ||
                        0
                    );


                const bTime =
                    Number(
                        b.submitted_at ||
                        0
                    );


                return bTime - aTime;

            }
        );


        return res.status(200).json({

            requests: requests

        });


    } catch (error) {

        console.error(
            "FIREBASE VERIFICATION REQUEST ERROR:",
            error
        );


        return res.status(500).json({

            error:
                "Unable to fetch verification requests.",

            details:
                error.message ||
                ""

        });

    }

};

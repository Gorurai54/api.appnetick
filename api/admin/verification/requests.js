const {
    dataDB
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
        "GET"
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

        const snapshot =
            await dataDB
                .ref(
                    "VerificationRequests"
                )
                .once(
                    "value"
                );


        const raw =
            snapshot.val() || {};


        const requests =
            Object.entries(
                raw
            )
            .map(
                ([key, value]) => ({

                    requestId:
                        key,

                    ...value

                })
            );


        requests.sort(
            (a, b) => {

                const statusA =
                    (
                        a.verification_status ||
                        "pending"
                    ).toLowerCase();

                const statusB =
                    (
                        b.verification_status ||
                        "pending"
                    ).toLowerCase();


                if (
                    statusA ===
                    "pending" &&
                    statusB !==
                    "pending"
                ) {

                    return -1;
                }


                if (
                    statusA !==
                    "pending" &&
                    statusB ===
                    "pending"
                ) {

                    return 1;
                }


                return (
                    Number(
                        b.submitted_at ||
                        0
                    ) -
                    Number(
                        a.submitted_at ||
                        0
                    )
                );

            }
        );


        return res
            .status(200)
            .json({

                success:true,

                requests

            });

    } catch (error) {

        console.error(
            "Verification requests:",
            error
        );


        return res
            .status(500)
            .json({
                success:false,
                error:
                    "Unable to load verification requests."
            });
    }
}

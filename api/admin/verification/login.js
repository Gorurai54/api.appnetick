const {
    createAdminToken,
    verifyAdminPassword
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


    try {

        const password =
            req.body &&
            req.body.password;


        if (
            typeof password !==
            "string" ||
            !password
        ) {

            return res
                .status(400)
                .json({
                    success:false,
                    error:
                        "Password is required."
                });
        }


        const valid =
            verifyAdminPassword(
                password
            );


        if (!valid) {

            return res
                .status(401)
                .json({
                    success:false,
                    error:
                        "Incorrect admin password."
                });
        }


        const token =
            createAdminToken();


        return res
            .status(200)
            .json({

                success:true,

                token,

                expiresIn:
                    2 * 60 * 60

            });

    } catch (error) {

        console.error(
            "Verification admin login:",
            error
        );


        return res
            .status(500)
            .json({
                success:false,
                error:
                    "Authentication system error."
            });
    }
}

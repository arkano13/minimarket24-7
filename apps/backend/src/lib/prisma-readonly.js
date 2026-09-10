    import  {PrismaClient } from '@prisma/client';

    const prismaReadonly = new PrismaClient({
        datasources: {
            db:{url: process.env.DATABASE_URL_READONLY}
        }
    })

    export default prismaReadonly;
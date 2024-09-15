import Collection from '@/lib/models/Collection'
import Product from '@/lib/models/Product'
import { connectToDB } from '@/lib/mongoDB'
import { auth } from '@clerk/nextjs/server'
import { ObjectId } from 'mongoose'
import { NextRequest, NextResponse } from 'next/server'

export const GET = async (
    req: NextRequest,
    { params }: { params: { productId: string } },
) => {
    try {
        await connectToDB()

        const product = await Product.findById(params.productId).populate({
            path: 'collections',
            model: Collection,
        })

        if (!product) {
            return new NextResponse(
                JSON.stringify({ message: 'Product not found' }),
                { status: 404 },
            )
        }

        return new NextResponse(JSON.stringify(product), {
            status: 200,
            headers: {
                'Access-Control-Allow-Origin': `${process.env.ECOMMERCE_STORE_URL}`,
                'Access-Control-Allow-Methods': 'GET',
                'Access-Control-Allow-Headers': 'Content-Type',
            },
        })
    } catch (error) {
        console.log('[productId_GET]', error)
        return new NextResponse('Internal error', { status: 500 })
    }
}

export const POST = async (
    req: NextRequest,
    { params }: { params: { productId: string } },
) => {
    try {
        const { userId } = auth()

        if (!userId) {
            return new NextResponse('Unauthorized', { status: 401 })
        }

        await connectToDB()

        const product = await Product.findById(params.productId)

        if (!product) {
            return new NextResponse(
                JSON.stringify({ message: 'Product not found' }),
                { status: 404 },
            )
        }

        const {
            title,
            description,
            media,
            category,
            collections,
            tags,
            sizes,
            colors,
            price,
            expense,
        } = await req.json()

        if (
            !title ||
            !description ||
            !media ||
            !category ||
            !price ||
            !expense
        ) {
            return new NextResponse('Not enough data to create a product', {
                status: 400,
            })
        }

        const addedCollections = collections.filter(
            (collectionId: string) =>
                !product.collections.some(
                    (productCollectionId: ObjectId) =>
                        productCollectionId.toString() === collectionId,
                ),
        )

        const removedCollections = product.collections.filter(
            (collectionId: ObjectId) =>
                !collections.includes(collectionId.toString()),
        )

        await Promise.all(
            addedCollections.map((collectionId: string) =>
                Collection.findByIdAndUpdate(collectionId, {
                    $push: { products: product._id },
                }),
            ),
        )

        await Promise.all(
            removedCollections.map((collectionId: string) =>
                Collection.findByIdAndUpdate(collectionId, {
                    $pull: { products: product._id },
                }),
            ),
        )

        const updatedProduct = await Product.findByIdAndUpdate(
            product._id,
            {
                title,
                description,
                media,
                category,
                collections,
                tags,
                sizes,
                colors,
                price,
                expense,
            },
            { new: true },
        ).populate({ path: 'collections', model: Collection })

        await updatedProduct.save()
        const coll = await Collection.find()

        return NextResponse.json({ coll, updatedProduct }, { status: 200 })
    } catch (error) {
        console.log('[productId_POST]', error)
        return new NextResponse('Internal error', { status: 500 })
    }
}

export const DELETE = async (
    req: NextRequest,
    { params }: { params: { productId: string } },
) => {
    try {
        const { userId } = auth()

        if (!userId) {
            return new NextResponse('Unauthorized', { status: 401 })
        }

        await connectToDB()

        const product = await Product.findById(params.productId)

        if (!product) {
            return new NextResponse(
                JSON.stringify({ message: 'Product not found' }),
                { status: 404 },
            )
        }

        await Product.findByIdAndDelete(product._id)

        await Promise.all(
            product.collections.map((collectionId: string) =>
                Collection.findByIdAndUpdate(collectionId, {
                    $pull: { products: product._id },
                }),
            ),
        )

        return new NextResponse(
            JSON.stringify({ message: 'Product deleted' }),
            {
                status: 200,
            },
        )
    } catch (err) {
        console.log('[productId_DELETE]', err)
        return new NextResponse('Internal error', { status: 500 })
    }
}

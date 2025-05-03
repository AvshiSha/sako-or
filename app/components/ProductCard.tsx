import Image from 'next/image'
import Link from 'next/link'

interface ProductCardProps {
  id: number
  name: string
  price: number
  image: string
  category: string
}

export default function ProductCard({ id, name, price, image, category }: ProductCardProps) {
  return (
    <Link href={`/product/${id}`} className="group">
      <div className="aspect-square relative overflow-hidden rounded-lg bg-gray-50">
        <Image
          src={image}
          alt={name}
          width={500}
          height={500}
          className="object-cover object-center group-hover:opacity-75 transition-opacity"
        />
      </div>
      <div className="mt-4">
        <h3 className="text-sm font-medium text-gray-900">{name}</h3>
        <p className="mt-1 text-sm text-gray-500">{category}</p>
        <p className="mt-1 text-sm font-medium text-gray-900">${price.toFixed(2)}</p>
      </div>
    </Link>
  )
} 
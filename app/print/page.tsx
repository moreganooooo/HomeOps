import Link from 'next/link'
export default function PrintIndex(){
return (
<div className="space-y-3">
<h1 className="text-2xl font-extrabold">Print</h1>
<Link className="card h-12 flex items-center justify-center" href="/print/fridge">Fridge Grid</Link>
<Link className="card h-12 flex items-center justify-center" href="/print/grocery">Grocery List</Link>
</div>
)
}
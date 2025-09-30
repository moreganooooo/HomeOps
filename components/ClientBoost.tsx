'use client'
import { useEffect } from 'react'
import { registerSW } from '@/lib/sw-register'
import OfflineBanner from '@/components/OfflineBanner'
import Bootstrap from '@/components/Bootstrap'

export default function ClientBoot(){
useEffect(() => { registerSW() }, [])
return (<>
<Bootstrap />
<OfflineBanner />
</>)
}
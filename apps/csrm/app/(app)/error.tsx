'use client'; import { ErrorState } from '@/components/states/states'; export default function Error({ reset }: { error:Error; reset:() => void }) { return <ErrorState retry={reset}/>; }

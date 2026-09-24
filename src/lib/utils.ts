import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const formatDuration = (duration: number)=>{
  const totalSeconds = Math.floor(duration / 1000)
  const seconds = totalSeconds % 60
  const minutes = Math.floor(totalSeconds / 60) % 60
  const hours = Math.floor(totalSeconds / 3600)
  const ss = seconds.toString().padStart(2, "0")
  if (hours > 0) {
    const mm = minutes.toString().padStart(2, "0")
    return `${hours}:${mm}:${ss}`
  }
  return `${minutes.toString().padStart(2, "0")}:${ss}`
}

export const snakeCaseToTitle = (str: string) => {
  return str.replace(/_/g, " ").replace(/\b\w/g, (char)=>char.toUpperCase())
}
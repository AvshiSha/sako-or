import { sanitizeCmsHtml } from '@/lib/sanitize-html'
import { cn } from '@/lib/utils'

interface RichContentProps {
  html: string
  className?: string
  dir?: 'ltr' | 'rtl'
}

export default function RichContent({ html, className, dir }: RichContentProps) {
  const sanitized = sanitizeCmsHtml(html)
  if (!sanitized.trim()) return null

  return (
    <div
      dir={dir}
      className={cn(
        'cms-content max-w-none leading-relaxed',
        '[&_p]:mb-4 [&_p:last-child]:mb-0 [&_p]:text-lg [&_p]:text-gray-700 [&_p]:leading-relaxed',
        '[&_h2]:mt-8 [&_h2]:mb-4 [&_h2]:text-2xl [&_h2]:font-semibold [&_h2]:text-gray-900',
        '[&_h3]:mt-6 [&_h3]:mb-3 [&_h3]:text-xl [&_h3]:font-semibold [&_h3]:text-gray-900',
        '[&_ul]:text-gray-700 [&_ol]:text-gray-700',
        '[&_strong]:font-semibold [&_strong]:text-gray-900',
        '[&_a]:text-[#856D55] hover:[&_a]:underline',
        '[&_img]:my-6 [&_img]:max-w-full [&_img]:rounded-md',
        '[&_.youtube-embed]:my-6 [&_.youtube-embed]:aspect-video [&_.youtube-embed]:w-full',
        '[&_iframe]:my-6 [&_iframe]:aspect-video [&_iframe]:w-full [&_iframe]:max-w-full [&_iframe]:rounded-md',
        className
      )}
      dangerouslySetInnerHTML={{ __html: sanitized }}
    />
  )
}

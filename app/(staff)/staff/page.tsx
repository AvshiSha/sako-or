import { redirect } from 'next/navigation'

/**
 * `/staff` has nothing of its own. The warehouse screen is the whole feature,
 * so this sends people straight there rather than offering a menu of one.
 */
export default function StaffIndexPage() {
  redirect('/staff/stock')
}

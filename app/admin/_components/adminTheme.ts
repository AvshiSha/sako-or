export const adminTheme = {
  pageBg: 'min-h-screen bg-[#E1DBD7]',
  headerBg: 'bg-black',
  headerText: 'text-[#E1DBD7]',
  headerMuted: 'text-[#B2A28E]',
  card: 'bg-white rounded-lg shadow-sm ring-1 ring-[#B2A28E]/30',
  cardHeader: 'border-b border-[#E1DBD7]',
  title: 'text-2xl sm:text-3xl font-bold text-black',
  subtitle: 'mt-1 text-sm text-[#856D55]',
  buttonPrimary:
    'inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-[#856D55] hover:bg-[#95816C] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#856D55] disabled:opacity-50 disabled:cursor-not-allowed transition-colors',
  buttonPrimaryFull:
    'flex w-full items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-[#856D55] hover:bg-[#95816C] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#856D55] disabled:opacity-50 disabled:cursor-not-allowed transition-colors',
  buttonSecondary:
    'inline-flex items-center px-4 py-2 border border-[#B2A28E] text-sm font-medium rounded-md shadow-sm text-black bg-white hover:bg-[#E1DBD7]/50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#856D55] disabled:opacity-50 disabled:cursor-not-allowed transition-colors',
  input:
    'block w-full px-3 py-2 border border-[#B2A28E] rounded-md bg-white text-black placeholder-[#B2A28E] focus:outline-none focus:ring-1 focus:ring-[#856D55] focus:border-[#856D55] sm:text-sm',
  select:
    'block w-full px-3 py-2 border border-[#B2A28E] rounded-md shadow-sm bg-white text-black focus:outline-none focus:ring-[#856D55] focus:border-[#856D55] sm:text-sm',
  tableHead: 'bg-[#E1DBD7]/60',
  tableRowHover: 'hover:bg-[#E1DBD7]/30',
  link: 'text-[#856D55] hover:text-[#95816C]',
  spinner: 'animate-spin rounded-full h-12 w-12 border-b-2 border-[#856D55] mx-auto',
  badgeActive: 'bg-green-100 text-green-800',
  badgeInactive: 'bg-red-100 text-red-800',
  badgeFeatured: 'bg-[#E1DBD7] text-[#856D55]',
  badgeNew: 'bg-[#B2A28E]/30 text-[#856D55]',
  quickActionIcon: 'rounded-lg inline-flex p-3 bg-[#E1DBD7] text-[#856D55] ring-4 ring-white',
  quickActionCard:
    'relative group bg-white p-6 focus-within:ring-2 focus-within:ring-inset focus-within:ring-[#856D55] rounded-lg border border-[#B2A28E]/40 hover:border-[#856D55]/60 transition-colors',
  tabActive: 'border-[#856D55] text-[#856D55]',
  tabInactive: 'border-transparent text-[#95816C] hover:text-[#856D55] hover:border-[#B2A28E]',
} as const

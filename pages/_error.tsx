import * as Sentry from '@sentry/nextjs'
import type { NextPageContext } from 'next'
import NextErrorComponent from 'next/error'

type ErrorProps = {
  statusCode: number
}

const CustomErrorComponent = ({ statusCode }: ErrorProps) => {
  return <NextErrorComponent statusCode={statusCode} />
}

CustomErrorComponent.getInitialProps = async (contextData: NextPageContext) => {
  await Sentry.captureUnderscoreErrorException(contextData)

  return NextErrorComponent.getInitialProps(contextData)
}

export default CustomErrorComponent

declare module 'react-whatsapp-button' {
  import { CSSProperties } from 'react';

  export interface WhatsAppButtonProps {
    phoneNumber: string;
    countryCode: string;
    message?: string;
    callback?: () => void;
    style?: CSSProperties;
    animated?: boolean;
  }

  export default function WhatsAppButton(props: WhatsAppButtonProps): JSX.Element;
}


export interface CodeDelivery {
  email: string;
  code: string;
  expiresAt: Date;
}

export interface CodeSender {
  send(delivery: CodeDelivery): Promise<void>;
}

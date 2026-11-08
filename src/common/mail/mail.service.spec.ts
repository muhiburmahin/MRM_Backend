import { MailService } from './mail.service';
import { MailConfig } from './mail.config';
import { MailTransport } from './mail-transport.interface';

describe('MailService', () => {
  const baseConfig: MailConfig = {
    enabled: true,
    from: 'MRM InfoTech <no-reply@mrminfotech.com>',
    notifyRecipient: 'leads@mrminfotech.com',
    smtp: {
      host: 'smtp.example.com',
      port: 587,
      secure: false,
      user: 'user',
      pass: 'pass',
    },
  };

  const mockTransport: jest.Mocked<MailTransport> = {
    send: jest.fn(),
  };

  beforeEach(() => {
    jest.resetAllMocks();
    mockTransport.send.mockResolvedValue(true);
  });

  it('skips dispatching lead notification when mail is disabled', async () => {
    const svc = new MailService({ ...baseConfig, enabled: false }, mockTransport);
    const result = await svc.notifyNewLead({
      ref: 'LD-20261031-112233',
      name: 'John Doe',
      email: 'john@example.com',
      message: 'Hello MRM',
      type: 'GENERAL',
    });
    expect(result).toBe(false);
    expect(mockTransport.send).not.toHaveBeenCalled();
  });

  it('dispatches lead alert when mail is enabled and transport succeeds', async () => {
    const svc = new MailService(baseConfig, mockTransport);
    const result = await svc.notifyNewLead({
      ref: 'LD-20261031-112233',
      name: 'John Doe',
      email: 'john@example.com',
      phone: '+8801700000000',
      message: 'Interested in EduManage BD',
      type: 'GENERAL',
    });
    expect(result).toBe(true);
    expect(mockTransport.send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'leads@mrminfotech.com',
        replyTo: 'john@example.com',
        subject: expect.stringContaining('LD-20261031-112233'),
        text: expect.stringContaining('Interested in EduManage BD'),
      }),
    );
  });

  it('handles transport failure gracefully without throwing', async () => {
    mockTransport.send.mockRejectedValue(new Error('Connection timed out'));
    const svc = new MailService(baseConfig, mockTransport);
    jest.spyOn((svc as any).logger, 'warn').mockImplementation(() => {});
    const result = await svc.notifyNewLead({
      ref: 'LD-20261031-112233',
      name: 'John Doe',
      email: 'john@example.com',
      message: 'Hello MRM',
      type: 'GENERAL',
    });
    expect(result).toBe(false);
  });

  it('sends customer confirmation email when mail is enabled', async () => {
    const svc = new MailService(baseConfig, mockTransport);
    const result = await svc.sendCustomerConfirmation({
      ref: 'LD-20261031-112233',
      name: 'Jane Doe',
      email: 'jane@example.com',
    });
    expect(result).toBe(true);
    expect(mockTransport.send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'jane@example.com',
        subject: expect.stringContaining('LD-20261031-112233'),
        text: expect.stringContaining('Dear Jane Doe,'),
      }),
    );
  });

  it('safely handles missing recipient configuration without crashing', async () => {
    const svc = new MailService({ ...baseConfig, notifyRecipient: '' }, mockTransport);
    jest.spyOn((svc as any).logger, 'warn').mockImplementation(() => {});
    const result = await svc.notifyNewLead({
      ref: 'LD-20261031-112233',
      name: 'John Doe',
      email: 'john@example.com',
      message: 'Hello',
      type: 'GENERAL',
    });
    expect(result).toBe(false);
    expect(mockTransport.send).not.toHaveBeenCalled();
  });
});

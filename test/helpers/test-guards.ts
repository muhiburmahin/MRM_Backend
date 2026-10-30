export const ADMIN_TOKEN = 'e2e-admin-session-token';
export const USER_TOKEN = 'e2e-user-session-token';

export const ADMIN = {
  Cookie: `mrm_session=${ADMIN_TOKEN}`,
  Origin: 'http://allowed.example',
};

export const USER = {
  Cookie: `mrm_session=${USER_TOKEN}`,
  Origin: 'http://allowed.example',
};

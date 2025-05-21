import { parseAsBoolean, useQueryState, useQueryStates, parseAsString } from 'nuqs';

export const useOpenComposeModal = () => {
  const [{ isComposeOpen: isOpen, subject, to, cc, bcc, body }, setParams] = useQueryStates({
    isComposeOpen: parseAsBoolean.withDefault(false).withOptions({ clearOnDefault: true }),
    subject: parseAsString.withDefault('').withOptions({ clearOnDefault: true }),
    to: parseAsString.withDefault('').withOptions({ clearOnDefault: true }),
    cc: parseAsString.withDefault('').withOptions({ clearOnDefault: true }),
    bcc: parseAsString.withDefault('').withOptions({ clearOnDefault: true }),
    body: parseAsString.withDefault('').withOptions({ clearOnDefault: true }),
  });

  const open = () =>
    setParams({
      isComposeOpen: true,
    });
  const close = () =>
    setParams({
      isComposeOpen: false,
    });

  return {
    open,
    close,
    isOpen,
    setIsOpen: (open: boolean) => setParams({ isComposeOpen: open }),
    subject,
    to: to.split(','),
    cc: cc.split(','),
    bcc: bcc.split(','),
    body,
  };
};

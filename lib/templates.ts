export const messageTemplates = [
  {
    id: 'first-response',
    title: 'First response',
    icon: 'wave',
    en: 'Hi {name}! Thank you for contacting us. We received your message about {subject}. How can we help you further?',
    bn: 'হ্যালো {name}! আমাদের সাথে যোগাযোগ করার জন্য ধন্যবাদ। {subject} বিষয়ে আপনার বার্তা পেয়েছি। আমরা কীভাবে সাহায্য করতে পারি?',
  },
  {
    id: 'gentle-followup',
    title: 'Gentle follow-up',
    icon: 'clock',
    en: 'Hi {name}, just following up on your interest in {subject}. Please let us know if you have any questions!',
    bn: 'হ্যালো {name}, {subject} বিষয়ে আপনার আগ্রহের ব্যাপারে আবার যোগাযোগ করছি। কোনো প্রশ্ন থাকলে আমাদের জানান!',
  },
  {
    id: 'order-confirmation',
    title: 'Ready to order',
    icon: 'check',
    en: 'Hi {name}! We can help you with {subject}. Whenever you are ready, please confirm the details so we can proceed.',
    bn: 'হ্যালো {name}! {subject} বিষয়ে আমরা সাহায্য করতে প্রস্তুত। আপনি প্রস্তুত হলে বিস্তারিত নিশ্চিত করুন।',
  },
] as const;

export function fillTemplate(template: string, name = 'there', subject = 'your inquiry'): string {
  return template.replaceAll('{name}', name || 'there').replaceAll('{subject}', subject || 'your inquiry');
}

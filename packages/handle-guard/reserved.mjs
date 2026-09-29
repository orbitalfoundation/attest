// Names a site usually needs for itself when user handles share its URL space (example.com/<handle>) or its subdomains
// (<handle>.example.com): roles people might impersonate, mail and DNS infrastructure, sign-in and account pages, and common
// page and file names. Deliberately generic; add your own brand, product and page names on top.
export const RESERVED_PATHS = Object.freeze(`
admin administrator administrators root system sysadmin superuser support help helpdesk contact info team staff official
owner moderator moderators moderation mod mods abuse security safety trust privacy legal terms tos policy policies copyright
dmca report reports postmaster hostmaster webmaster noreply no-reply mailer daemon www www1 www2 mail email smtp imap pop pop3
ftp sftp ssh ns1 ns2 dns mx cdn static assets media img images files uploads download downloads public api graphql rpc
webhook webhooks callback oauth auth login logout signin signout signup register password reset verify verification confirm
invite invites account accounts settings preferences profile profiles user users member members me you self everyone anyone
nobody somebody null undefined none true false nan test tests testing demo example sample guest anonymous anon about docs doc
documentation faq blog news status health version changelog search explore home index dashboard feed feeds rss atom
notifications messages inbox new create edit delete share embed widget app apps billing pricing plans checkout cart shop store
jobs careers press donate sponsor contact robots sitemap favicon manifest well-known
`.trim().split(/\s+/));

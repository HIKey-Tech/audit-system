// scripts/test-ldap.ts
/**
 * Standalone Active Directory (LDAP) connectivity test script.
 * Usage:
 *   npx ts-node scripts/test-ldap.ts
 *   npx ts-node scripts/test-ldap.ts <username>
 */
import dotenv from 'dotenv';
dotenv.config();

import { Client, InvalidCredentialsError } from 'ldapts';

const url = process.env.LDAP_URL || 'ldap://10.0.124.10:389';
const bindDn = process.env.LDAP_BIND_DN || 'gbb-iams@galaxybb.local';
const bindPassword = process.env.LDAP_BIND_PASSWORD || 'Auditmgt12#$';
const baseDn = process.env.LDAP_BASE_DN || 'DC=galaxybb,DC=local';
const targetUser = process.argv[2];

async function run() {
  console.log('====================================================');
  console.log('IAMS — Active Directory (LDAP) Connectivity Diagnostic');
  console.log('====================================================');
  console.log(`Server URL:      ${url}`);
  console.log(`Bind Account:    ${bindDn}`);
  console.log(`Base DN:         ${baseDn}`);
  if (targetUser) {
    console.log(`Target User:     ${targetUser}`);
  }
  console.log(`Password length: ${bindPassword.length} characters ${bindPassword.length < 12 ? '⚠️ (WARNING: Likely truncated by # in .env! Must quote: LDAP_BIND_PASSWORD=\'Auditmgt12#$\')' : '✅'}`);
  console.log('----------------------------------------------------');

  const candidateDns = [
    bindDn,
    'GALAXYBB\\gbb-iams',
    'gbb-iams',
    `CN=gbb-iams,CN=Users,${baseDn}`,
    `CN=gbb-iams,OU=Users,${baseDn}`,
  ].filter((v, i, a) => a.indexOf(v) === i);

  let client = new Client({
    url,
    timeout: 7000,
    connectTimeout: 7000,
    strictDN: false,
  });

  let successfulDn: string | null = null;

  try {
    console.log('1. Connecting and testing bind account formats...');
    for (const testDn of candidateDns) {
      process.stdout.write(`   Trying bind as "${testDn}"... `);
      const testClient = new Client({ url, timeout: 7000, connectTimeout: 7000, strictDN: false });
      try {
        const startTime = Date.now();
        await testClient.bind(testDn, bindPassword);
        const duration = Date.now() - startTime;
        console.log(`✅ SUCCESS in ${duration}ms!`);
        successfulDn = testDn;
        client = testClient;
        break;
      } catch (bindErr: unknown) {
        const errMsg = bindErr instanceof Error ? bindErr.message : String(bindErr);
        console.log(`❌ ${errMsg}`);

        const dataMatch = errMsg.match(/data\s+([0-9a-fA-F]+)/i);
        if (dataMatch) {
          const code = dataMatch[1].toLowerCase();
          const adCodeDescriptions: Record<string, string> = {
            '52e': 'Username or password does not match what is stored in Active Directory',
            '52f': 'Account restriction prevents logon',
            '530': 'Not permitted to logon at this time',
            '531': 'Not permitted to logon at this workstation',
            '532': 'Password has expired',
            '533': 'Account is disabled in Active Directory',
            '701': 'Account has expired in Active Directory',
            '773': 'User MUST change password at next logon (flag is set in Active Directory)',
            '775': 'Account is locked out in Active Directory (too many failed attempts)',
          };
          const explanation = adCodeDescriptions[code] || `Active Directory error subcode data=${code}`;
          console.log(`      ↳ AD Diagnostic: ${explanation}`);
        }
        await testClient.unbind().catch(() => {});
      }
    }

    if (!successfulDn) {
      console.log('\n----------------------------------------------------');
      console.log('❌ All bind attempts failed.');
      process.exit(1);
    }

    console.log(`\n✅ Active Directory Bind Verified! Use LDAP_BIND_DN='${successfulDn}'`);

    console.log('\n2. Querying Active Directory RootDSE / Base DN...');
    const { searchEntries: rootEntries } = await client.search(baseDn, {
      scope: 'base',
      filter: '(objectClass=*)',
      attributes: ['defaultNamingContext', 'supportedLDAPVersion'],
    });

    if (rootEntries.length > 0) {
      console.log('✅ Base DN verified:', JSON.stringify(rootEntries[0], null, 2));
    }

    if (targetUser) {
      console.log(`\n3. Searching for user: "${targetUser}"...`);
      const safe = targetUser.replace(/\\/g, '\\5c').replace(/\*/g, '\\2a').replace(/\(/g, '\\28').replace(/\)/g, '\\29');
      const filter = `(&(objectCategory=person)(objectClass=user)(|(sAMAccountName=${safe})(userPrincipalName=${safe})(mail=${safe})))`;

      const { searchEntries: userEntries } = await client.search(baseDn, {
        scope: 'sub',
        filter,
        attributes: [
          'dn',
          'sAMAccountName',
          'userPrincipalName',
          'mail',
          'displayName',
          'givenName',
          'sn',
          'title',
          'department',
          'telephoneNumber',
          'memberOf',
          'userAccountControl',
        ],
      });

      if (userEntries.length === 0) {
        console.log(`⚠️ User "${targetUser}" was not found in ${baseDn}.`);
      } else {
        const u = userEntries[0];
        console.log('✅ User found:');
        console.log(`   DN:                  ${u.dn}`);
        console.log(`   sAMAccountName:      ${u.sAMAccountName}`);
        console.log(`   UserPrincipalName:   ${u.userPrincipalName ?? '(none)'}`);
        console.log(`   Email:               ${u.mail ?? '(none)'}`);
        console.log(`   Display Name:        ${u.displayName ?? '(none)'}`);
        console.log(`   Title / Department:  ${u.title ?? '-'} / ${u.department ?? '-'}`);
        console.log(`   Groups (memberOf):   ${Array.isArray(u.memberOf) ? u.memberOf.length : (u.memberOf ? 1 : 0)} groups`);
        if (u.memberOf) {
          const groups = Array.isArray(u.memberOf) ? u.memberOf : [u.memberOf];
          groups.slice(0, 5).forEach((g) => console.log(`      - ${g}`));
          if (groups.length > 5) console.log(`      ... and ${groups.length - 5} more`);
        }
      }
    }

    console.log('\n====================================================');
    console.log('🎉 Active Directory (LDAP) configuration is HEALTHY!');
    console.log('====================================================');
    process.exit(0);
  } catch (err: unknown) {
    console.error('\n❌ Active Directory connection failed!');
    if (err instanceof InvalidCredentialsError) {
      console.error('Reason: Invalid credentials for bind account (check LDAP_BIND_DN / LDAP_BIND_PASSWORD)');
    } else if (err instanceof Error) {
      console.error(`Error details: ${err.name} - ${err.message}`);
      if (/timed out/i.test(err.message) || /ECONNREFUSED/i.test(err.message) || /ENOTFOUND/i.test(err.message)) {
        console.error('\nNetwork Diagnostics:');
        console.error('• The domain controller IP/hostname could not be reached over the network.');
        console.error(`• Verify that this machine has routing/VPN access to ${url} on port 389.`);
        console.error('• If running inside Docker on the VPS, ensure the host network allows egress to 10.0.124.10.');
      }
    } else {
      console.error('Unknown error:', err);
    }
    console.log('====================================================');
    process.exit(1);
  } finally {
    await client.unbind().catch(() => {});
  }
}

run();

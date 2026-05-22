const http = require('http');

const request = (path, method, data) => {
    return new Promise((resolve, reject) => {
        const payload = JSON.stringify(data);
        const req = http.request({
            hostname: 'localhost',
            port: 3000,
            path: path,
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(payload)
            }
        }, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                try {
                    resolve({
                        statusCode: res.statusCode,
                        data: JSON.parse(body)
                    });
                } catch(e) {
                    resolve({
                        statusCode: res.statusCode,
                        data: body
                    });
                }
            });
        });

        req.on('error', reject);
        req.write(payload);
        req.end();
    });
};

const runTests = async () => {
    console.log('=== STARTING OTP ENDPOINT TESTS ===\n');

    // 1. Send OTP (Signup Flow)
    console.log('[Test 1] Requesting OTP for Signup (email & phone)...');
    const signupOtpRes = await request('/api/otp/send', 'POST', {
        email: 'newuser@example.com',
        phone: '9988776655'
    });
    console.log(`Status: ${signupOtpRes.statusCode}`);
    console.log('Response:', signupOtpRes.data);
    if (signupOtpRes.statusCode === 200 && signupOtpRes.data.success && signupOtpRes.data.emailOtp && signupOtpRes.data.smsOtp) {
        console.log('✅ Signup OTP Request Passed!\n');
    } else {
        console.log('❌ Signup OTP Request Failed!\n');
    }

    // 2. Send OTP (Forgot Password - Existing Email)
    console.log('[Test 2] Requesting OTP for Forgot Password (registered email)...');
    const resetOtpRes = await request('/api/otp/send', 'POST', {
        email: 'test@example.com' // Already exists in user list
    });
    console.log(`Status: ${resetOtpRes.statusCode}`);
    console.log('Response:', resetOtpRes.data);
    if (resetOtpRes.statusCode === 200 && resetOtpRes.data.success && resetOtpRes.data.emailOtp && resetOtpRes.data.smsOtp) {
        console.log('✅ Existing Forgot Password OTP Request Passed (automatically fetched phone)!');
        console.log(`Masked Phone returned: ${resetOtpRes.data.phone}`);
        console.log('\n');
    } else {
        console.log('❌ Existing Forgot Password OTP Request Failed!\n');
    }

    // 3. Send OTP (Forgot Password - Unregistered Email)
    console.log('[Test 3] Requesting OTP for Forgot Password (unregistered email)...');
    const unregisteredOtpRes = await request('/api/otp/send', 'POST', {
        email: 'unregistered_random_user@example.com'
    });
    console.log(`Status: ${unregisteredOtpRes.statusCode}`);
    console.log('Response:', unregisteredOtpRes.data);
    if (unregisteredOtpRes.statusCode === 404 && !unregisteredOtpRes.data.success) {
        console.log('✅ Unregistered Forgot Password OTP correctly rejected with 404!\n');
    } else {
        console.log('❌ Unregistered Forgot Password OTP Request Failed to reject!\n');
    }

    // 4. Verify OTP (Master Bypass Code)
    console.log('[Test 4] Verifying OTP using Master Bypass Code 123456...');
    const verifyBypassRes = await request('/api/otp/verify', 'POST', {
        email: 'test@example.com',
        emailOtp: '123456',
        smsOtp: '123456'
    });
    console.log(`Status: ${verifyBypassRes.statusCode}`);
    console.log('Response:', verifyBypassRes.data);
    if (verifyBypassRes.statusCode === 200 && verifyBypassRes.data.success) {
        console.log('✅ OTP Verification Master Bypass Passed!\n');
    } else {
        console.log('❌ OTP Verification Master Bypass Failed!\n');
    }

    // 5. Reset Password
    console.log('[Test 5] Triggering Reset Password for test@example.com...');
    const resetPassRes = await request('/api/user/reset-password-otp', 'POST', {
        email: 'test@example.com',
        password: 'password123' // Keep it original so standard credentials aren't broken
    });
    console.log(`Status: ${resetPassRes.statusCode}`);
    console.log('Response:', resetPassRes.data);
    if (resetPassRes.statusCode === 200 && resetPassRes.data.success) {
        console.log('✅ Password Reset Persist Endpoint Passed!\n');
    } else {
        console.log('❌ Password Reset Persist Endpoint Failed!\n');
    }

    console.log('=== COMPLETED OTP ENDPOINT TESTS ===');
};

runTests().catch(console.error);

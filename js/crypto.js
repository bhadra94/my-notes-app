class CryptoManager {
    constructor() {
        this.algorithm = 'AES-GCM';
        this.keyLength = 256;
        this.ivLength = 12;
    }

    async generateKey(password) {
        const encoder = new TextEncoder();
        const data = encoder.encode(password);
        
        const hash = await crypto.subtle.digest('SHA-256', data);
        
        return await crypto.subtle.importKey(
            'raw',
            hash,
            { name: this.algorithm },
            false,
            ['encrypt', 'decrypt']
        );
    }

    async encrypt(text, password) {
        try {
            const key = await this.generateKey(password);
            const encoder = new TextEncoder();
            const data = encoder.encode(text);
            
            const iv = crypto.getRandomValues(new Uint8Array(this.ivLength));
            
            const encrypted = await crypto.subtle.encrypt(
                {
                    name: this.algorithm,
                    iv: iv
                },
                key,
                data
            );
            
            const result = new Uint8Array(iv.length + encrypted.byteLength);
            result.set(iv);
            result.set(new Uint8Array(encrypted), iv.length);
            
            return btoa(String.fromCharCode.apply(null, result));
        } catch (error) {
            console.error('Encryption error:', error);
            throw new Error('Failed to encrypt data');
        }
    }

    async decrypt(encryptedText, password) {
        try {
            const key = await this.generateKey(password);
            const data = new Uint8Array(atob(encryptedText).split('').map(char => char.charCodeAt(0)));
            
            const iv = data.slice(0, this.ivLength);
            const encrypted = data.slice(this.ivLength);
            
            const decrypted = await crypto.subtle.decrypt(
                {
                    name: this.algorithm,
                    iv: iv
                },
                key,
                encrypted
            );
            
            const decoder = new TextDecoder();
            return decoder.decode(decrypted);
        } catch (error) {
            console.error('Decryption error:', error);
            throw new Error('Failed to decrypt data - invalid password or corrupted data');
        }
    }

    generatePassword(length = 16, includeSymbols = true, includeNumbers = true, includeUppercase = true, includeLowercase = true) {
        let charset = '';
        if (includeLowercase) charset += 'abcdefghijklmnopqrstuvwxyz';
        if (includeUppercase) charset += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        if (includeNumbers) charset += '0123456789';
        if (includeSymbols) charset += '!@#$%^&*()_+-=[]{}|;:,.<>?';
        
        if (charset === '') {
            throw new Error('At least one character type must be selected');
        }
        
        let password = '';
        for (let i = 0; i < length; i++) {
            const randomIndex = crypto.getRandomValues(new Uint32Array(1))[0] % charset.length;
            password += charset[randomIndex];
        }
        
        return password;
    }

    calculatePasswordStrength(password) {
        let score = 0;
        let feedback = [];
        
        if (password.length < 8) {
            feedback.push('Password should be at least 8 characters long');
        } else if (password.length >= 8) {
            score += 1;
        }
        
        if (password.length >= 12) {
            score += 1;
        }
        
        if (/[a-z]/.test(password)) {
            score += 1;
        } else {
            feedback.push('Add lowercase letters');
        }
        
        if (/[A-Z]/.test(password)) {
            score += 1;
        } else {
            feedback.push('Add uppercase letters');
        }
        
        if (/[0-9]/.test(password)) {
            score += 1;
        } else {
            feedback.push('Add numbers');
        }
        
        if (/[^a-zA-Z0-9]/.test(password)) {
            score += 1;
        } else {
            feedback.push('Add special characters');
        }
        
        if (/(.)\1{2,}/.test(password)) {
            score -= 1;
            feedback.push('Avoid repeated characters');
        }
        
        let strength = 'weak';
        if (score >= 4) strength = 'medium';
        if (score >= 6) strength = 'strong';
        
        return {
            score,
            strength,
            feedback,
            percentage: Math.min(100, (score / 6) * 100)
        };
    }

    async hashPassword(password) {
        const encoder = new TextEncoder();
        const data = encoder.encode(password);
        const hash = await crypto.subtle.digest('SHA-256', data);
        return btoa(String.fromCharCode.apply(null, new Uint8Array(hash)));
    }

    maskSensitiveData(data, visibleChars = 4) {
        if (!data || data.length <= visibleChars) return data;
        const masked = '*'.repeat(data.length - visibleChars);
        return masked + data.slice(-visibleChars);
    }

    generateSecureId() {
        const array = new Uint8Array(16);
        crypto.getRandomValues(array);
        return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
    }
}

window.cryptoManager = new CryptoManager();
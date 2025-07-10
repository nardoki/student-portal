import Joi from 'joi';

// Reusable email validator
const email = Joi.string().email({
  tlds: { allow: false }
}).required().messages({
  'string.email': 'Please enter a valid email address',
  'string.empty': 'Email is required'
});

// Reusable password validator
const password = Joi.string().min(6).required().messages({
  'string.min': 'Password must be at least 6 characters',
  'string.empty': 'Password is required'
});

export const loginSchema = Joi.object({
  email,
  password,
});

export const registerSchema = Joi.object({
  fullName: Joi.string().required().messages({
    'string.empty': 'Full name is required'
  }),
  email,
  password,
  role: Joi.string().valid('student', 'teacher').required().messages({
    'any.only': 'Role must be either student or teacher',
    'string.empty': 'Role is required'
  })
});
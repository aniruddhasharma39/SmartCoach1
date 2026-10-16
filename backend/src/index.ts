import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import rolesRoutes from './routes/roles';
import modulesRoutes from './routes/modules';
import registrationFormsRoutes from './routes/registration-forms';
import settingsRoutes from './routes/settings';
import lcgateRoutes from './routes/lcgate';
import evidenceRoutes from './routes/evidence';
import notificationsRoutes from './routes/notifications';
import scopeGroupsRoutes from './routes/scopeGroups';
import servicesRoutes from './routes/services';
import { errorHandler } from './middleware/error';
import { prisma } from './lib/prisma';

import path from 'path';

dotenv.config();

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// Normalize repeated slashes in request paths (e.g., //api/v1 -> /api/v1)
app.use((req, res, next) => {
  if (req.url.includes('//')) {
    req.url = req.url.replace(/\/+/g, '/');
  }
  next();
});

// Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/roles', rolesRoutes);
app.use('/api/v1/modules', modulesRoutes);
app.use('/api/v1/registration-forms', registrationFormsRoutes);
app.use('/api/v1/settings', settingsRoutes);
app.use('/api/v1/branding', settingsRoutes);
app.use('/api/v1/lcgate', lcgateRoutes);
app.use('/api/v1/evidence', evidenceRoutes);
app.use('/api/v1/notifications', notificationsRoutes);
app.use('/api/v1/scope-groups', scopeGroupsRoutes);
app.use('/api/v1/services', servicesRoutes);

// Error Handling
app.use(errorHandler);

// Ensure system modules exist
const ensureSystemModules = async () => {
  try {
    await prisma.module.upsert({
      where: { slug: 'scope-groups' },
      update: {},
      create: { name: 'Scope Groups', slug: 'scope-groups' }
    });
    await prisma.module.upsert({
      where: { slug: 'services' },
      update: {},
      create: { name: 'Services', slug: 'services' }
    });
  } catch (err) {
    console.error('Failed to ensure scope-groups module:', err);
  }
};

app.listen(port, () => {
  ensureSystemModules();
  console.log(`Server is running on port ${port}`);
});

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('CREATE', 'UPDATE', 'DELETE');

-- CreateEnum
CREATE TYPE "AuditEntityType" AS ENUM ('USER', 'GROUP', 'INVITE', 'APP', 'CATEGORY', 'SETTING');

-- CreateEnum
CREATE TYPE "SyncTarget" AS ENUM ('LDAP', 'DISCOURSE');

-- CreateEnum
CREATE TYPE "SyncOperation" AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'SYNC_GROUPS');

-- CreateEnum
CREATE TYPE "SyncStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'RETRYING');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "name" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "image" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "location" TEXT,
    "preferredLanguage" TEXT NOT NULL DEFAULT 'de',
    "preferredColorMode" TEXT,
    "storageQuota" TEXT NOT NULL DEFAULT '1 GB',
    "primaryGroupId" TEXT,
    "ldapDn" TEXT,
    "ldapUidNumber" INTEGER,
    "ldapSynced" BOOLEAN NOT NULL DEFAULT false,
    "ldapSyncedAt" TIMESTAMP(3),
    "discourseId" TEXT,
    "discourseSynced" BOOLEAN NOT NULL DEFAULT false,
    "discourseSyncedAt" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "idToken" TEXT,
    "password" TEXT,
    "passwordHashType" TEXT DEFAULT 'scrypt',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Verification" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Verification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Group" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "ldapDn" TEXT,
    "ldapSynced" BOOLEAN NOT NULL DEFAULT false,
    "ldapSyncedAt" TIMESTAMP(3),
    "discourseId" INTEGER,
    "discourseSynced" BOOLEAN NOT NULL DEFAULT false,
    "discourseSyncedAt" TIMESTAMP(3),

    CONSTRAINT "Group_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroupMembership" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GroupMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroupOwnership" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GroupOwnership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroupHierarchy" (
    "id" TEXT NOT NULL,
    "parentGroupId" TEXT NOT NULL,
    "childGroupId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GroupHierarchy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invite" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT NOT NULL,

    CONSTRAINT "Invite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InviteGroupMembership" (
    "id" TEXT NOT NULL,
    "inviteId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,

    CONSTRAINT "InviteGroupMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InviteGroupOwnership" (
    "id" TEXT NOT NULL,
    "inviteId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,

    CONSTRAINT "InviteGroupOwnership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "App" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "url" TEXT NOT NULL,
    "iconUrl" TEXT,
    "logoUrl" TEXT,
    "useIconAsLogo" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "samlEnabled" BOOLEAN NOT NULL DEFAULT false,
    "samlEntityId" TEXT,
    "samlAcsUrl" TEXT,
    "samlSloUrl" TEXT,
    "samlCertificate" TEXT,
    "oidcEnabled" BOOLEAN NOT NULL DEFAULT false,
    "oidcClientId" TEXT,
    "oidcRedirectUris" TEXT,
    "oidcClientSecret" TEXT,
    "isMain" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "App_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppGroupAccess" (
    "id" TEXT NOT NULL,
    "appId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,

    CONSTRAINT "AppGroupAccess_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SamlSessionApp" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "appId" TEXT NOT NULL,
    "nameId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SamlSessionApp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiscourseCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '0088cc',
    "textColor" TEXT NOT NULL DEFAULT 'ffffff',
    "parentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "discourseId" INTEGER,
    "discourseSynced" BOOLEAN NOT NULL DEFAULT false,
    "discourseSyncedAt" TIMESTAMP(3),

    CONSTRAINT "DiscourseCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CategoryGroupAccess" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,

    CONSTRAINT "CategoryGroupAccess_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Setting" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Setting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailTemplate" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "config" JSONB NOT NULL DEFAULT '{}',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncEvent" (
    "id" TEXT NOT NULL,
    "target" "SyncTarget" NOT NULL,
    "operation" "SyncOperation" NOT NULL,
    "entityType" "AuditEntityType" NOT NULL,
    "entityId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "SyncStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "SyncEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "action" "AuditAction" NOT NULL,
    "entityType" "AuditEntityType" NOT NULL,
    "entityId" TEXT NOT NULL,
    "oldValue" JSONB,
    "newValue" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "User_ldapDn_key" ON "User"("ldapDn");

-- CreateIndex
CREATE UNIQUE INDEX "User_ldapUidNumber_key" ON "User"("ldapUidNumber");

-- CreateIndex
CREATE UNIQUE INDEX "User_discourseId_key" ON "User"("discourseId");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_username_idx" ON "User"("username");

-- CreateIndex
CREATE INDEX "User_ldapDn_idx" ON "User"("ldapDn");

-- CreateIndex
CREATE INDEX "User_discourseId_idx" ON "User"("discourseId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_token_key" ON "Session"("token");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Session_token_idx" ON "Session"("token");

-- CreateIndex
CREATE INDEX "Account_userId_idx" ON "Account"("userId");

-- CreateIndex
CREATE INDEX "Verification_identifier_idx" ON "Verification"("identifier");

-- CreateIndex
CREATE UNIQUE INDEX "Group_slug_key" ON "Group"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Group_ldapDn_key" ON "Group"("ldapDn");

-- CreateIndex
CREATE UNIQUE INDEX "Group_discourseId_key" ON "Group"("discourseId");

-- CreateIndex
CREATE INDEX "Group_slug_idx" ON "Group"("slug");

-- CreateIndex
CREATE INDEX "Group_ldapDn_idx" ON "Group"("ldapDn");

-- CreateIndex
CREATE INDEX "GroupMembership_userId_idx" ON "GroupMembership"("userId");

-- CreateIndex
CREATE INDEX "GroupMembership_groupId_idx" ON "GroupMembership"("groupId");

-- CreateIndex
CREATE UNIQUE INDEX "GroupMembership_userId_groupId_key" ON "GroupMembership"("userId", "groupId");

-- CreateIndex
CREATE INDEX "GroupOwnership_userId_idx" ON "GroupOwnership"("userId");

-- CreateIndex
CREATE INDEX "GroupOwnership_groupId_idx" ON "GroupOwnership"("groupId");

-- CreateIndex
CREATE UNIQUE INDEX "GroupOwnership_userId_groupId_key" ON "GroupOwnership"("userId", "groupId");

-- CreateIndex
CREATE INDEX "GroupHierarchy_parentGroupId_idx" ON "GroupHierarchy"("parentGroupId");

-- CreateIndex
CREATE INDEX "GroupHierarchy_childGroupId_idx" ON "GroupHierarchy"("childGroupId");

-- CreateIndex
CREATE UNIQUE INDEX "GroupHierarchy_parentGroupId_childGroupId_key" ON "GroupHierarchy"("parentGroupId", "childGroupId");

-- CreateIndex
CREATE UNIQUE INDEX "Invite_token_key" ON "Invite"("token");

-- CreateIndex
CREATE INDEX "Invite_token_idx" ON "Invite"("token");

-- CreateIndex
CREATE INDEX "Invite_email_idx" ON "Invite"("email");

-- CreateIndex
CREATE INDEX "InviteGroupMembership_inviteId_idx" ON "InviteGroupMembership"("inviteId");

-- CreateIndex
CREATE UNIQUE INDEX "InviteGroupMembership_inviteId_groupId_key" ON "InviteGroupMembership"("inviteId", "groupId");

-- CreateIndex
CREATE INDEX "InviteGroupOwnership_inviteId_idx" ON "InviteGroupOwnership"("inviteId");

-- CreateIndex
CREATE UNIQUE INDEX "InviteGroupOwnership_inviteId_groupId_key" ON "InviteGroupOwnership"("inviteId", "groupId");

-- CreateIndex
CREATE UNIQUE INDEX "App_slug_key" ON "App"("slug");

-- CreateIndex
CREATE INDEX "App_slug_idx" ON "App"("slug");

-- CreateIndex
CREATE INDEX "AppGroupAccess_appId_idx" ON "AppGroupAccess"("appId");

-- CreateIndex
CREATE INDEX "AppGroupAccess_groupId_idx" ON "AppGroupAccess"("groupId");

-- CreateIndex
CREATE UNIQUE INDEX "AppGroupAccess_appId_groupId_key" ON "AppGroupAccess"("appId", "groupId");

-- CreateIndex
CREATE INDEX "SamlSessionApp_sessionId_idx" ON "SamlSessionApp"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "SamlSessionApp_sessionId_appId_key" ON "SamlSessionApp"("sessionId", "appId");

-- CreateIndex
CREATE UNIQUE INDEX "DiscourseCategory_slug_key" ON "DiscourseCategory"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "DiscourseCategory_discourseId_key" ON "DiscourseCategory"("discourseId");

-- CreateIndex
CREATE INDEX "DiscourseCategory_slug_idx" ON "DiscourseCategory"("slug");

-- CreateIndex
CREATE INDEX "DiscourseCategory_discourseId_idx" ON "DiscourseCategory"("discourseId");

-- CreateIndex
CREATE INDEX "CategoryGroupAccess_categoryId_idx" ON "CategoryGroupAccess"("categoryId");

-- CreateIndex
CREATE INDEX "CategoryGroupAccess_groupId_idx" ON "CategoryGroupAccess"("groupId");

-- CreateIndex
CREATE UNIQUE INDEX "CategoryGroupAccess_categoryId_groupId_key" ON "CategoryGroupAccess"("categoryId", "groupId");

-- CreateIndex
CREATE UNIQUE INDEX "Setting_key_key" ON "Setting"("key");

-- CreateIndex
CREATE INDEX "Setting_key_idx" ON "Setting"("key");

-- CreateIndex
CREATE UNIQUE INDEX "EmailTemplate_key_key" ON "EmailTemplate"("key");

-- CreateIndex
CREATE INDEX "EmailTemplate_key_idx" ON "EmailTemplate"("key");

-- CreateIndex
CREATE INDEX "SyncEvent_status_target_idx" ON "SyncEvent"("status", "target");

-- CreateIndex
CREATE INDEX "SyncEvent_createdAt_idx" ON "SyncEvent"("createdAt");

-- CreateIndex
CREATE INDEX "SyncEvent_entityType_entityId_idx" ON "SyncEvent"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_actorId_idx" ON "AuditLog"("actorId");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_primaryGroupId_fkey" FOREIGN KEY ("primaryGroupId") REFERENCES "Group"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupMembership" ADD CONSTRAINT "GroupMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupMembership" ADD CONSTRAINT "GroupMembership_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupOwnership" ADD CONSTRAINT "GroupOwnership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupOwnership" ADD CONSTRAINT "GroupOwnership_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupHierarchy" ADD CONSTRAINT "GroupHierarchy_parentGroupId_fkey" FOREIGN KEY ("parentGroupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupHierarchy" ADD CONSTRAINT "GroupHierarchy_childGroupId_fkey" FOREIGN KEY ("childGroupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invite" ADD CONSTRAINT "Invite_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InviteGroupMembership" ADD CONSTRAINT "InviteGroupMembership_inviteId_fkey" FOREIGN KEY ("inviteId") REFERENCES "Invite"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InviteGroupOwnership" ADD CONSTRAINT "InviteGroupOwnership_inviteId_fkey" FOREIGN KEY ("inviteId") REFERENCES "Invite"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppGroupAccess" ADD CONSTRAINT "AppGroupAccess_appId_fkey" FOREIGN KEY ("appId") REFERENCES "App"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppGroupAccess" ADD CONSTRAINT "AppGroupAccess_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SamlSessionApp" ADD CONSTRAINT "SamlSessionApp_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SamlSessionApp" ADD CONSTRAINT "SamlSessionApp_appId_fkey" FOREIGN KEY ("appId") REFERENCES "App"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiscourseCategory" ADD CONSTRAINT "DiscourseCategory_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "DiscourseCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CategoryGroupAccess" ADD CONSTRAINT "CategoryGroupAccess_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "DiscourseCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CategoryGroupAccess" ADD CONSTRAINT "CategoryGroupAccess_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

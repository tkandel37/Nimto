"use client";

import { ProfileForm, UserWorkspace } from "../user-workspace";

export default function ProfilePage() {
  return (
    <UserWorkspace activePage="profile">
      {({ authHeaders, refreshUser, showToast, user }) => (
        <ProfileForm
          authHeaders={authHeaders}
          refreshUser={refreshUser}
          showToast={showToast}
          user={user}
        />
      )}
    </UserWorkspace>
  );
}

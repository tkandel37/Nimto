# Module 2: Template and Design

## Purpose

Module 2 controls how Nimto staff create reusable HTML invitation templates, publish them as user-facing designs, organize them by dynamic categories, and prepare them for event creation and sharing.

The core rule is simple:

Template is the editable, unpublished HTML working file.
Design is the published version users can select.

## Key Decisions

- Staff upload one complete `.html` file for the template.
- The HTML must follow Nimto's strict template format using `data-nimto-field`.
- Nimto will not auto-detect random text from normal HTML in MVP.
- Staff can edit template content from live preview and side form.
- Staff can manage fields in a layer/section structure.
- Categories and subcategories are dynamic and editable from admin/staff tools.
- Designs are free for now.
- Custom guest name personalization is paid later.
- Published designs are versioned.
- Old events must keep using the exact design version they were created with.
- User-facing preview should render actual HTML, including animation.
- Social share previews should use SEO/Open Graph metadata and a reliable preview fallback, but the main in-app preview remains HTML.

## Template vs Design

### Template

A template is a staff-created working file.

It contains:

- uploaded HTML
- parsed field schema
- section/page structure
- default content
- field rules
- template status
- owner staff user

Template statuses:

- `draft`
- `published`
- `unpublished`

### Design

A design is a published template version visible to users.

It contains:

- frozen HTML snapshot
- frozen schema snapshot
- category and subcategory
- version number
- lifecycle status
- public visibility rules

Design version statuses:

- `current`
- `superseded`

Only `current` designs are shown to users.

If staff edits an already published template and publishes again, Nimto creates a new design version. The previous design version becomes `superseded`.

## Nimto HTML Template Format

Every AI-created or staff-uploaded design HTML must be one complete `.html` file.

Allowed:

- HTML
- CSS inside `<style>`
- vanilla JavaScript inside `<script>`

Not allowed in MVP:

- React, Vue, Angular, Tailwind, Bootstrap
- external JavaScript libraries
- backend code
- API keys
- payment logic
- login logic
- database logic
- unknown tracking scripts

### Metadata Block

Every template must include:

```html
<script type="application/json" id="nimto-template-meta">
{
  "name": "Elegant Invitation",
  "category": "Wedding",
  "subcategory": "Reception",
  "version": "1.0.0",
  "supportedModes": ["generic", "personalized"],
  "sections": [],
  "fields": [],
  "features": []
}
</script>
```

### Sections and Pages

The AI should organize the design into clear pages or sections.

Examples:

- cover page
- details page
- information page
- family page
- gallery page
- closing page

HTML example:

```html
<section
  data-nimto-section="cover"
  data-nimto-section-label="Cover Page">
  <h1 data-nimto-field="coverTitle">{{coverTitle}}</h1>
</section>
```

Metadata example:

```json
{
  "key": "cover",
  "label": "Cover Page",
  "order": 1
}
```

### Field Rule

Every visible editable item must be a field.

This includes:

- heading text
- paragraph text
- button labels
- dates
- times
- venue text
- image URLs
- audio URLs, only if music exists in the design
- map URLs, only if map exists in the design
- RSVP labels, only if RSVP exists in the design

No fixed required fields exist globally. Each template defines its own fields.

Example:

```html
<p data-nimto-field="openingMessage">{{openingMessage}}</p>
<p data-nimto-field="footerMessage">{{footerMessage}}</p>
```

Even if two fields are both paragraphs, they must be separate fields when they appear in different positions or serve different design purposes.

### Field Metadata

Each field must include enough information for Nimto to build editor controls.

```json
{
  "key": "openingMessage",
  "label": "Opening Message",
  "type": "textarea",
  "section": "cover",
  "required": false,
  "paid": false,
  "editableByUser": true,
  "locked": false,
  "defaultValue": "Together with their families, they invite you to celebrate."
}
```

Supported field types for MVP:

- `text`
- `textarea`
- `date`
- `time`
- `datetime`
- `image`
- `audio`
- `url`
- `color`
- `number`
- `guestName`

### Generic and Personalized Modes

Each design can support normal sharing and paid personalized sharing.

Generic mode:

```html
<div data-nimto-mode="generic">
  You are invited to
</div>
```

Personalized mode:

```html
<div data-nimto-mode="personalized">
  Dear <span data-nimto-field="guestName">{{guestName}}</span>, you are invited to
</div>
```

`guestName` is a special field. It enables paid custom-name invitations later.

```json
{
  "key": "guestName",
  "label": "Guest Name",
  "type": "guestName",
  "section": "cover",
  "required": false,
  "paid": true,
  "editableByUser": true,
  "locked": false,
  "defaultValue": "Guest"
}
```

### Feature Rule

Features must only exist if the design actually uses them.

Do not force every template to include music, gallery, map, RSVP, or countdown.

Supported feature types for MVP planning:

- `countdown`
- `map`
- `music`
- `gallery`
- `rsvp`
- `calendar`
- `animation`
- `guestPersonalization`

Countdown example:

```html
<div
  data-nimto-feature="countdown"
  data-nimto-date-field="eventDateTime">
</div>
```

Metadata example:

```json
{
  "key": "mainCountdown",
  "type": "countdown",
  "section": "details",
  "usesField": "eventDateTime"
}
```

## Staff Experience

Staff should be encouraged to create designs quickly.

The editor should not feel like a long form first. It should open the uploaded HTML in a live preview.

Staff can:

- upload `.html`
- see live HTML preview with animation
- click editable text directly in preview
- edit selected field from side panel
- browse fields by section/page/layer
- mark fields required or optional
- mark fields editable by user or locked
- mark fields paid or free
- change field labels and types
- publish or unpublish
- duplicate template or design to create variations

## Permission Group

These permissions belong to the Template and Design module. They should be separate from login/auth/staff permissions.

Recommended permission keys:

- `template:view:own`
- `template:view:all`
- `template:create`
- `template:update:own`
- `template:update:all`
- `template:publish`
- `template:unpublish`
- `template:duplicate`
- `design:view:own`
- `design:view:all`
- `design:manage:own`
- `design:manage:all`
- `category:view`
- `category:manage`
- `subcategory:view`
- `subcategory:manage`

Business rules:

- Staff with own permissions can only see or manage records created by them.
- Staff with all permissions can see or manage all template/design records.
- Category and subcategory management requires category permissions.
- Super admin bypasses all checks using existing super admin behavior.

## Category and Subcategory

Categories and subcategories are part of this module.

They are used by staff for organization and by users for browsing.

Category fields:

- name
- slug
- description
- icon or image later
- sort order
- status

Subcategory fields:

- category
- name
- slug
- description
- sort order
- status

Statuses:

- `active`
- `inactive`

Categories and subcategories can be edited anytime. Existing designs should keep their category relationship unless staff moves them.

## User-Side Design Browsing

Users should only see:

- active categories
- active subcategories
- published current designs

Users should not see:

- templates
- draft templates
- unpublished templates
- superseded design versions
- staff-only metadata

Design browsing should support:

- category filter
- subcategory filter
- search
- preview
- select design

Preview must render the HTML design itself, not only an image.

## Event Creation Dependency

After a user selects a design, Module 3 or the Event module will use the design schema to create an event editing experience.

Important behavior:

- generic share link is the first priority
- custom guest-name links are paid later
- event stores the exact design version used
- event editing should use side form and live preview
- user should only edit fields where `editableByUser` is true
- locked fields remain visible but not editable

## Sharing and SEO Dependency

Every event created from a design must be shareable.

The share link should support:

- SEO title
- SEO description
- Open Graph title
- Open Graph description
- Open Graph preview
- public event URL

Main Nimto preview should remain HTML so animations work inside Nimto.

External platforms like Messenger and Instagram may not reliably animate link previews. Therefore, animated social preview is future exploration, not MVP dependency.

## Epic Breakdown

### 2.1: Permission and Role Foundation

Goal:
Add Template and Design permission keys to the existing permission catalog.

Features:

- Add template/design/category permission keys.
- Group permissions clearly as design-module permissions.
- Seed permissions through existing admin permission seed flow.
- Enforce own vs all access rules.

Acceptance criteria:

- Super admin can access all module actions.
- Staff with own permission only accesses their own templates/designs.
- Staff with all permission accesses all templates/designs.
- Category management requires category permissions.

### 2.2: Dynamic Category and Subcategory Management

Goal:
Allow staff/admin to create and maintain design categories and subcategories.

Features:

- Create category.
- Edit category.
- Activate/inactivate category.
- Create subcategory under category.
- Edit subcategory.
- Activate/inactivate subcategory.
- Sort categories and subcategories.

Acceptance criteria:

- Categories and subcategories are dynamic.
- User browsing only shows active records.
- Existing designs can remain attached when category details change.

### 2.3: Template Upload and Storage

Goal:
Allow permitted staff to upload one `.html` template file.

Features:

- Upload `.html`.
- Store raw HTML exactly.
- Store owner staff user.
- Set initial status as `draft`.
- Validate file is HTML.
- Reject missing Nimto metadata block.

Acceptance criteria:

- Valid Nimto HTML uploads as draft template.
- Invalid HTML or missing metadata fails with useful error.
- Uploaded raw HTML is preserved.

### 2.4: Nimto HTML Scanner and Validator

Goal:
Parse template metadata, sections, fields, modes, and features from uploaded HTML.

Features:

- Read `nimto-template-meta`.
- Validate all metadata fields exist in HTML.
- Validate all `data-nimto-field` values exist in metadata.
- Validate unique field keys.
- Validate section references.
- Validate features only reference existing fields.
- Validate generic/personalized mode blocks when declared.

Acceptance criteria:

- Scanner produces schema JSON.
- Invalid field mismatch is reported clearly.
- Countdown can connect to date/datetime field.
- No auto-detection of random HTML text in MVP.

### 2.5: Staff Template Editor

Goal:
Let staff edit templates using live HTML preview and side panel.

Features:

- Render uploaded HTML preview.
- Click editable field in preview.
- Edit selected field value.
- Edit from side form.
- Show fields by section/page/layer.
- Set required/optional.
- Set editable by user or locked.
- Set paid/free.
- Set field type.
- Save draft changes.

Acceptance criteria:

- Staff can edit content directly from preview.
- Staff can manage field rules from side panel.
- Layer panel follows section/page structure.
- HTML preview remains the main visual source.

### 2.6: Template Publish and Design Versioning

Goal:
Publish a template as a user-facing design version.

Features:

- Publish draft template.
- Create design version snapshot.
- Mark new design version as `current`.
- Mark previous current design version as `superseded`.
- Unpublish template/design.
- Keep old design versions for existing events.

Acceptance criteria:

- Users only see current published designs.
- Superseded designs are hidden from browsing.
- Old events still render using their original design version.
- Editing a published template creates a new version on publish.

### 2.7: Staff Design Library

Goal:
Allow staff to manage and browse templates/designs based on permission.

Features:

- My templates.
- All templates for permitted staff.
- Current designs.
- Superseded versions for permitted staff.
- Duplicate template/design.
- Filter by category/subcategory/status/owner.

Acceptance criteria:

- Own/all permissions are respected.
- Staff can duplicate to create variations.
- Superseded versions are not shown to normal users.

### 2.8: User Design Browsing

Goal:
Let users explore available current designs.

Features:

- Browse categories.
- Browse subcategories.
- View current designs.
- Search designs.
- Open live HTML preview.
- Select design for event creation.

Acceptance criteria:

- Only active categories/subcategories are shown.
- Only current designs are shown.
- Preview renders actual HTML.

### 2.9: Event Creation Handoff

Goal:
Prepare selected design data for the Event module.

Features:

- Pass design version ID into event creation.
- Generate user-editable form from schema.
- Respect `editableByUser`.
- Respect locked fields.
- Support generic mode first.
- Prepare personalized mode for paid custom names later.

Acceptance criteria:

- Event stores immutable design version reference.
- User form is generated from design schema.
- Generic share link can be created after event creation.

### 2.10: Share Link and SEO Foundation

Goal:
Prepare event pages created from designs for reliable sharing.

Features:

- Public event URL.
- SEO title.
- SEO description.
- Open Graph title.
- Open Graph description.
- Preview fallback for external platforms.
- HTML invitation rendering on public event page.

Acceptance criteria:

- Shared link has meaningful preview metadata.
- Public event page renders the invitation HTML.
- Social animation is not required for MVP.

## AI Prompt for Generating Nimto HTML

```text
Create one complete .html file for a Nimto digital invitation template.

Design goal:
Create a beautiful, premium, mobile-first invitation design. The design can be for any event type. Do not assume fixed wedding fields unless the design itself is a wedding invitation.

Technical rules:
- Output only one complete .html file.
- Use HTML, CSS, and vanilla JavaScript only.
- Put all CSS inside one <style> tag.
- Put all JavaScript inside one <script> tag.
- Do not use React, Vue, Angular, Tailwind, Bootstrap, or external libraries.
- Do not include backend code, API keys, login logic, payment logic, database logic, or tracking scripts.
- The file must open directly in a browser.

Nimto structure rules:
- Include <script type="application/json" id="nimto-template-meta">.
- Organize the design into meaningful sections/pages such as cover page, details page, information page, gallery page, closing page, or other sections that match the design.
- Add data-nimto-section and data-nimto-section-label to each major section/page.
- Every visible editable text, title, paragraph, button label, date, time, venue, image URL, audio URL, or map URL must have its own field.
- Every editable element must include data-nimto-field="fieldKey".
- Every editable value must use {{fieldKey}} placeholder.
- Do not create global fixed required fields. The fields must match only this design.
- If two editable texts are in different positions or have different meanings, create separate fields for them.
- In metadata, every field must include key, label, type, section, required, paid, editableByUser, locked, and defaultValue.
- Include features only when the design actually has them.
- If countdown exists, declare a countdown feature and connect it to a date or datetime field.
- If map exists, declare a map feature.
- If music exists, declare a music feature.
- If gallery exists, declare a gallery feature.
- Support generic mode with data-nimto-mode="generic".
- If personalized guest-name sharing is included, support data-nimto-mode="personalized" and add guestName as type "guestName" with paid true.

Return only the final .html file content.
```

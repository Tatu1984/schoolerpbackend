import { FormBody, str } from '@/lib/form-body'

type VendorRow = { contactPerson: string | null }

// The vendors page reads `contact` and `category`. `contact` is an alias of
// contactPerson. The Vendor model has no category column, so `category` is
// always null (accepted on save but not persisted).
export function toPageVendor<T extends VendorRow>(vendor: T) {
  return {
    ...vendor,
    contact: vendor.contactPerson,
    category: null as string | null,
  }
}

/** Map page field names onto vendorSchema input; only keys present in the body are returned. */
export function normalizeVendorBody(body: FormBody): FormBody {
  const out: FormBody = {}
  if (body.name !== undefined) out.name = str(body.name) ?? ''
  if (body.code !== undefined && str(body.code)) out.code = str(body.code)
  const contact = body.contactPerson ?? body.contact
  if (contact !== undefined) out.contactPerson = str(contact)
  if (body.phone !== undefined) out.phone = str(body.phone)
  if (body.email !== undefined) out.email = str(body.email)?.toLowerCase() ?? null
  if (body.address !== undefined) out.address = str(body.address)
  if (body.gst !== undefined) out.gst = str(body.gst)
  if (typeof body.isActive === 'boolean') out.isActive = body.isActive
  return out
}

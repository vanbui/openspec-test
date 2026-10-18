# Identity Management

The identities, accounts and access relationships managed by the proposed solution.

## Language

**Identity**:
The representation of a person, linking their records and accounts across connected systems.
_Avoid_: User, account when referring to the person across systems

**Source record**:
A record about a person held in an external identity source. Multiple source records may belong to one identity.

**Account**:
A person's representation in a particular connected system. One identity may have multiple accounts.
_Avoid_: Identity when referring to a system-specific account

**Entitlement**:
A permission or group membership associated with an account.
_Avoid_: Account, identity

**Affiliation**:
A person's relationship with the organization, such as employee or student. A person may hold multiple affiliations at the same time.
_Avoid_: Identity, account when referring to one organizational relationship

**Managed access**:
The explicitly selected permissions and memberships governed by this identity management solution. Other access remains separately administered.

**Desired state**:
The identity attributes, account status and managed access required by the applicable policies and authoritative records.
_Avoid_: Observed state when referring to what should exist

**Observed state**:
The identity attributes, account status and access currently present in a connected system.
_Avoid_: Desired state when referring to what currently exists

import { CheckIcon, XIcon } from "@heroicons/react/solid"
import { randomBytes } from "crypto"
import { W3CCredential } from "did-jwt-vc"
import Head from "next/head"
import QRCode from "qrcode.react"
import { useState } from "react"
import useSWRImmutable from "swr/immutable"
import {
  randomDidKey,
  buildAndSignVerifiableCredential,
  KYCAMLAttestation,
  buildIssuer,
  decodeVerifiableCredential,
  RevocableCredential,
  buildPresentationSubmission,
  VerificationOffer,
  ChallengeTokenUrlWrapper
} from "verite"

import type { Verifiable } from "verite"

const holder = randomDidKey(randomBytes)

/**
 * Issue a Verifiable Credential. This would traditionally be issued by the
 * issuer, but for the sake of the demo's focus on verification, we will do it
 * here. Note that a verifier and an issuer are not necessarily the same, so we
 * intentionally are not having the server return it to us in this demo.
 */
const issueCredential = async () => {
  // In a production environment, these values would be secured by the issuer
  const issuer = buildIssuer(
    process.env.NEXT_PUBLIC_ISSUER_DID,
    process.env.NEXT_PUBLIC_ISSUER_SECRET
  )

  // We will create a random did to represent our own identity wallet
  const subject = holder

  // Stubbed out credential data
  const attestation: KYCAMLAttestation = {
    type: "KYCAMLAttestation",
    process: "https://demos.verite.id/schemas/definitions/1.0.0/kycaml/usa",
    approvalDate: new Date().toISOString()
  }

  // Generate the signed, encoded credential
  const encoded = await buildAndSignVerifiableCredential(
    issuer,
    subject,
    attestation
  )

  const decoded = await decodeVerifiableCredential(encoded)

  return decoded
}
/**
 * Using Presentation Exchange, this is an API call that simulates the server
 * returning a Presentation Request, which will instruct the client how to
 * complete verification.
 */
const somethingThatRequiresVerification = async () => {
  // Assuming 0x18Fc8eA6c36f76b4B7DB6367657512a491BFe111 is our eth address
  const response = await fetch(
    `${process.env.NEXT_PUBLIC_BASEURL}/api/job?subjectAddress=0x18Fc8eA6c36f76b4B7DB6367657512a491BFe111`,
    { method: "POST" }
  )
  if (response.ok) {
    return response.json()
  }
}

export default function Home(): JSX.Element {
  // Challenge Response
  const [challengeResponse, setChallengeResponse] = useState()

  // Whether verification is successful or not.
  const [result, setResult] = useState<boolean>()

  // Credential
  const { data: credential } = useSWRImmutable("credential", async () =>
    issueCredential()
  )

  // Verification Presentation Request
  const { data: jobResponse } = useSWRImmutable(
    "somethingThatRequiresVerification",
    async () => somethingThatRequiresVerification()
  )
  const verificationRequest = challengeResponse

  const simulateScan = async (challenge: ChallengeTokenUrlWrapper) => {
    const url = challenge.challengeTokenUrl
    const response = await fetch(url, {
      method: "GET"
    })
    if (response.ok) {
      const json = await response.json()
      setChallengeResponse(json)
      return json
    }
  }

  // API call to complete verification
  const verifyCredential = async (
    verificationRequest: VerificationOffer,
    credential: Verifiable<W3CCredential> | RevocableCredential
  ) => {
    const subject = holder
    const request = await buildPresentationSubmission(
      subject,
      verificationRequest.body.presentation_definition,
      credential
    )

    const response = await fetch(verificationRequest.reply_url, {
      method: "POST",
      body: request
    })

    if (response.ok) {
      setResult(true)
    } else {
      setResult(false)
    }
  }

  // Determine which page to show
  let page: string
  if (result) {
    page = "done"
  } else if (verificationRequest) {
    page = "verification"
  } else if (jobResponse) {
    page = "challenge"
  }

  // Component to render the QR code
  const Scan = ({ challenge }) => {
    return (
      <>
        <div className="bg-white shadow sm:rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <h3 className="mb-4 text-xl font-semibold leading-6 text-yellow-500">
              Scan this QR code with your Trudenty wallet<sup className="text-gray-900">**</sup> to present your KYC credentials and complete your account opening online.
            </h3>
            <div className="prose">
              <div className="text-sm text-gray-500">
                <p><sup>**</sup> To launch the wallet app, you need to use <a href="https://expo.dev/client" target="_blank">Expo Go</a> after <a href="mailto:contact@trudenty.com">receiving our invitation</a>.</p>
              </div>
              <QRCode
                value={JSON.stringify(challenge)}
                className="w-80 h-80"
                renderAs="svg"
              />
              <pre>{JSON.stringify(challenge, null, 4)}</pre>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault()
                  simulateScan(challenge)
                }}
                className="inline-flex items-center px-4 py-2 font-medium text-white bg-yellow-500 border border-transparent rounded-md shadow-sm hover:bg-yellow-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-400 sm:text-sm"
              >
                Simulate Scanning
              </button>
            </div>
          </div>
        </div>
      </>
    )
  }

  // Component to render a Manifest
  const VerificationOffer = ({
    presentationRequest
  }: {
    presentationRequest: VerificationOffer
  }) => {
    const input =
      presentationRequest.body.presentation_definition.input_descriptors[0]
    const title = input.name
    const description = input.purpose

    return (
      <div className="bg-white shadow sm:rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          {result === false ? (
            <span className="flex flex-row items-center">
              <XIcon className="inline w-16 h-16 text-red-500"></XIcon>
              <span className="text-xl">Not Verified</span>
            </span>
          ) : null}

          {result === undefined ? (
            <>
              <h3 className="text-xl font-semibold leading-6 text-yellow-500">
                {title}
              </h3>
              <div className="max-w-xl mt-2 text-sm text-gray-500">
                <p>{description}</p>
              </div>
              <div className="mt-5">
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault()
                    verifyCredential(presentationRequest, credential)
                  }}
                  className="inline-flex items-center px-4 py-2 font-medium text-white bg-yellow-500 border border-transparent rounded-md shadow-sm hover:bg-yellow-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-400 sm:text-sm"
                >
                  Verify Credential
                </button>
              </div>
            </>
          ) : null}
        </div>
      </div>
    )
  }

  // Component to render the final successful result
  const VerificationResult = () => {
    return (
      <>
        <div className="bg-white shadow sm:rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <span className="flex flex-row items-center">
              <CheckIcon className="inline w-16 h-16 text-green-500"></CheckIcon>
              <span className="text-xl">Verified</span>
            </span>
          </div>
        </div>
      </>
    )
  }

  return (
    <div className="min-h-screen py-2 bg-gray-50">
      <Head>
        <title>Verification Demo</title>
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main className="w-full px-20 space-y-8">
        <div className="prose max-w-fit">
          <h1>Credentials Verification</h1>
          <p>
            This is a simple example of how to verify a credential using a
            self-custodied identity wallet.
            The first page prompts a compatible mobile wallet to scan a QR code.
            When you click <em>Simulate Scanning</em>, it will follow the URL to
            retrieve the full presentation request. Assuming the mobile wallet
            does not share state with the browser, details about the user and
            verification request are encoded in a JWT and passed along in the
            URL.
            Using{" "}
            <a href="https://identity.foundation/presentation-exchange">
              Presentation Exchange
            </a>{" "}
            the server will prompt us to provide a credential that satisfies its
            constraints. When you click the <em>Verify Credential</em> button,
            it will submit it to the server to be verified.
          </p>
        </div>
        {page === "challenge" ? <Scan challenge={jobResponse}></Scan> : null}

        {page === "verification" ? (
          <>
            <VerificationOffer
              presentationRequest={verificationRequest}
            ></VerificationOffer>

            <div className="prose" style={{ maxWidth: "100%" }}>
              <h2>Presentation Request</h2>
              <p>
                Then, using the Presentation Exchange spec, the server will
                issue a Presentation Request that we, as the client, will
                fulfill. Below is the Presentation Request.
              </p>
              <pre>{JSON.stringify(verificationRequest, null, 4)}</pre>
              <h2>Verifiable Credential</h2>
              <p>
                This is the Verifiable Credential we will use for verification.
              </p>
              <pre>{JSON.stringify(credential, null, 4)}</pre>
            </div>
          </>
        ) : null}

        {page === "done" ? (
          <VerificationResult />
        ) : null}
      </main>
    </div>
  )
}

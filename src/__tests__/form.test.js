describe("Form validation", () => {
  test("email format should be valid", () => {
    const email = "teste@example.com";
    expect(email.includes("@")).toBe(true);
  });

  test("password should not be empty", () => {
    const password = "123456";
    expect(password.length).toBeGreaterThan(0);
  });
});
